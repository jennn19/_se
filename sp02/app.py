import os
import sqlite3
from functools import wraps
from flask import Flask, render_template, request, redirect, url_for, session, flash, g

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "nqu.db")

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "nqu-secret-key-change-me")

WEEKDAYS = ["", "一", "二", "三", "四", "五", "六", "日"]
SEMESTER = "113學年度 第2學期"


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if "user_id" not in session:
            flash("請先登入", "warning")
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return wrapper


def role_required(*roles):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if "user_id" not in session:
                flash("請先登入", "warning")
                return redirect(url_for("login"))
            if session.get("role") not in roles:
                flash("沒有權限存取此頁面", "error")
                return redirect(url_for("index"))
            return f(*args, **kwargs)
        return wrapper
    return decorator


def current_user():
    if "user_id" not in session:
        return None
    db = get_db()
    return db.execute(
        "SELECT * FROM users WHERE user_id = ?", (session["user_id"],)
    ).fetchone()


@app.route("/")
@login_required
def index():
    return redirect(url_for("dashboard"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        user_id = request.form.get("user_id", "").strip()
        password = request.form.get("password", "")
        role = request.form.get("role", "student")
        db = get_db()
        user = db.execute(
            "SELECT * FROM users WHERE user_id = ? AND password = ? AND role = ?",
            (user_id, password, role),
        ).fetchone()
        if user:
            session.clear()
            session["user_id"] = user["user_id"]
            session["name"] = user["name"]
            session["role"] = user["role"]
            return redirect(url_for("dashboard"))
        flash("帳號、密碼或身分別錯誤", "error")
    return render_template("login.html", semester=SEMESTER)


@app.route("/logout")
def logout():
    session.clear()
    flash("已登出", "info")
    return redirect(url_for("login"))


@app.route("/dashboard")
@login_required
def dashboard():
    user = current_user()
    if user["role"] == "student":
        return redirect(url_for("student_home"))
    if user["role"] == "teacher":
        return redirect(url_for("teacher_home"))
    return redirect(url_for("admin_home"))


# ============================================================
# 學生端
# ============================================================

@app.route("/student")
@role_required("student")
def student_home():
    db = get_db()
    uid = session["user_id"]
    enrolled = db.execute(
        """SELECT c.*, u.name AS teacher_name, e.grade, e.semester FROM enrollments e
           JOIN courses c ON c.course_id = e.course_id
           JOIN users u ON u.user_id = c.teacher_id
           WHERE e.student_id = ? AND e.semester = ?
           ORDER BY c.weekday, c.period""",
        (uid, SEMESTER),
    ).fetchall()
    total_credits = sum(c["credits"] for c in enrolled)
    gpa_report = compute_gpa(db, uid)
    return render_template(
        "student/home.html",
        user=user_of(db, uid),
        enrolled=enrolled,
        total_credits=total_credits,
        gpa_report=gpa_report,
        semester=SEMESTER,
        weekday_names=WEEKDAYS,
    )


def user_of(db, uid):
    return db.execute("SELECT * FROM users WHERE user_id = ?", (uid,)).fetchone()


def compute_gpa(db, uid):
    rows = db.execute(
        """SELECT e.grade, c.credits FROM enrollments e
           JOIN courses c ON c.course_id = e.course_id
           WHERE e.student_id = ? AND e.grade IS NOT NULL""",
        (uid,),
    ).fetchall()
    if not rows:
        return {"gpa": 0.0, "count": 0}
    total = 0
    count = 0
    for r in rows:
        total += r["grade"] * r["credits"]
        count += r["credits"]
    return {"gpa": round(total / count, 2), "count": count}


@app.route("/student/courses")
@role_required("student")
def student_courses():
    db = get_db()
    uid = session["user_id"]
    enrolled_ids = {r["course_id"] for r in db.execute(
        "SELECT course_id FROM enrollments WHERE student_id = ?",
        (uid,),
    )}
    courses = db.execute(
        """SELECT c.*, u.name AS teacher_name,
                  (SELECT COUNT(*) FROM enrollments e
                   WHERE e.course_id = c.course_id) AS enrolled_count
           FROM courses c JOIN users u ON u.user_id = c.teacher_id
           ORDER BY c.weekday, c.period""",
    ).fetchall()
    return render_template(
        "student/courses.html",
        user=user_of(db, uid),
        courses=courses,
        enrolled_ids=enrolled_ids,
        semester=SEMESTER,
        weekday_names=WEEKDAYS,
    )


@app.route("/student/enroll/<course_id>", methods=["POST"])
@role_required("student")
def student_enroll(course_id):
    db = get_db()
    uid = session["user_id"]
    course = db.execute(
        "SELECT * FROM courses WHERE course_id = ?", (course_id,)
    ).fetchone()
    if not course:
        flash("課程不存在", "error")
        return redirect(url_for("student_courses"))
    taken = db.execute(
        "SELECT COUNT(*) AS n FROM enrollments WHERE course_id = ?",
        (course_id,),
    ).fetchone()
    if taken["n"] >= course["capacity"]:
        flash(f"課程 {course['name']} 選課人數已滿", "error")
        return redirect(url_for("student_courses"))
    conflict = db.execute(
        """SELECT c.name FROM enrollments e JOIN courses c ON c.course_id = e.course_id
           WHERE e.student_id = ? AND e.semester = ?
             AND c.weekday = ? AND c.period = ?""",
        (uid, SEMESTER, course["weekday"], course["period"]),
    ).fetchone()
    if conflict:
        flash(f"與課程「{conflict['name']}」時間衝突，無法加選", "error")
        return redirect(url_for("student_courses"))
    exists = db.execute(
        """SELECT 1 FROM enrollments WHERE student_id = ? AND course_id = ?
           AND semester = ?""",
        (uid, course_id, SEMESTER),
    ).fetchone()
    if exists:
        flash("你已選過這門課", "warning")
    else:
        db.execute(
            """INSERT INTO enrollments (student_id, course_id, semester)
               VALUES (?, ?, ?)""",
            (uid, course_id, SEMESTER),
        )
        db.commit()
        flash(f"成功加選「{course['name']}」", "success")
    return redirect(url_for("student_courses"))


@app.route("/student/drop/<course_id>", methods=["POST"])
@role_required("student")
def student_drop(course_id):
    db = get_db()
    uid = session["user_id"]
    db.execute(
        """DELETE FROM enrollments WHERE student_id = ? AND course_id = ?
           AND semester = ? AND grade IS NULL""",
        (uid, course_id, SEMESTER),
    )
    db.commit()
    flash("已退選該課程", "success")
    return redirect(url_for("student_courses"))


@app.route("/student/grades")
@role_required("student")
def student_grades():
    db = get_db()
    uid = session["user_id"]
    grades = db.execute(
        """SELECT c.course_id, c.name, c.credits, c.department, e.grade, e.semester
           FROM enrollments e JOIN courses c ON c.course_id = e.course_id
           WHERE e.student_id = ? AND e.grade IS NOT NULL
           ORDER BY e.semester DESC""",
        (uid,),
    ).fetchall()
    gpa_report = compute_gpa(db, uid)
    return render_template(
        "student/grades.html",
        user=user_of(db, uid),
        grades=grades,
        gpa_report=gpa_report,
    )


@app.route("/student/schedule")
@role_required("student")
def student_schedule():
    db = get_db()
    uid = session["user_id"]
    cells = db.execute(
        """SELECT c.*, u.name AS teacher_name, c.location
           FROM enrollments e JOIN courses c ON c.course_id = e.course_id
           JOIN users u ON u.user_id = c.teacher_id
           WHERE e.student_id = ? AND e.semester = ?""",
        (uid, SEMESTER),
    ).fetchall()
    grid = build_schedule_grid(cells)
    return render_template(
        "student/schedule.html",
        user=user_of(db, uid),
        grid=grid,
        weekday_names=WEEKDAYS,
        semester=SEMESTER,
        periods=PERIODS,
    )


PERIODS = [
    ("第1節", "08:10-09:00"),
    ("第2節", "09:10-10:00"),
    ("第3節", "10:10-11:00"),
    ("第4節", "11:10-12:00"),
    ("第5節", "13:10-14:00"),
    ("第6節", "14:10-15:00"),
    ("第7節", "15:10-16:00"),
    ("第8節", "16:10-17:00"),
    ("第9節", "17:10-18:00"),
]


def build_schedule_grid(cells):
    grid = {p: [None] * 8 for p in range(1, 10)}
    for c in cells:
        p = c["period"]
        grid[p][c["weekday"] - 1] = c
    return grid


# ============================================================
# 教師端
# ============================================================

@app.route("/teacher")
@role_required("teacher")
def teacher_home():
    db = get_db()
    uid = session["user_id"]
    courses = db.execute(
        """SELECT c.*, (SELECT COUNT(*) FROM enrollments e
           WHERE e.course_id = c.course_id) AS enrolled_count
           FROM courses c WHERE c.teacher_id = ? ORDER BY c.weekday, c.period""",
        (uid,),
    ).fetchall()
    stats = {
        "courses": len(courses),
        "students": sum(c["enrolled_count"] for c in courses),
        "credits": sum(c["credits"] for c in courses),
    }
    grid = build_schedule_grid(courses)
    return render_template(
        "teacher/home.html",
        user=user_of(db, uid),
        courses=courses,
        stats=stats,
        grid=grid,
        weekday_names=WEEKDAYS,
        periods=PERIODS,
        semester=SEMESTER,
    )


@app.route("/teacher/course/<course_id>")
@role_required("teacher")
def teacher_course(course_id):
    db = get_db()
    uid = session["user_id"]
    course = db.execute(
        """SELECT c.*, u.name AS teacher_name FROM courses c
           JOIN users u ON u.user_id = c.teacher_id
           WHERE c.course_id = ? AND c.teacher_id = ?""",
        (course_id, uid),
    ).fetchone()
    if not course:
        flash("找不到課程", "error")
        return redirect(url_for("teacher_home"))
    enrollments = db.execute(
        """SELECT u.user_id, u.name, u.department AS stu_department, e.grade
           FROM enrollments e JOIN users u ON u.user_id = e.student_id
           WHERE e.course_id = ? ORDER BY u.name""",
        (course_id,),
    ).fetchall()
    graded = sum(1 for e in enrollments if e["grade"] is not None)
    return render_template(
        "teacher/course.html",
        user=user_of(db, uid),
        course=course,
        enrollments=enrollments,
        graded=graded,
        semester=SEMESTER,
        weekday_names=WEEKDAYS,
    )


@app.route("/teacher/course/<course_id>/grade", methods=["POST"])
@role_required("teacher")
def teacher_grade(course_id):
    db = get_db()
    uid = session["user_id"]
    course = db.execute(
        "SELECT course_id FROM courses WHERE course_id = ? AND teacher_id = ?",
        (course_id, uid),
    ).fetchone()
    if not course:
        flash("沒有權限修改此課程成績", "error")
        return redirect(url_for("teacher_home"))
    for key, value in request.form.items():
        if key.startswith("grade_"):
            student_id = key.split("_", 1)[1]
            try:
                grade = float(value)
            except ValueError:
                continue
            db.execute(
                """UPDATE enrollments SET grade = ? WHERE student_id = ?
                   AND course_id = ? AND semester = ?""",
                (grade, student_id, course_id, SEMESTER),
            )
    db.commit()
    flash("成績已儲存", "success")
    return redirect(url_for("teacher_course", course_id=course_id))


# ============================================================
# 行政端
# ============================================================

@app.route("/admin")
@role_required("admin")
def admin_home():
    db = get_db()
    counts = {
        "students": db.execute("SELECT COUNT(*) FROM users WHERE role='student'").fetchone()[0],
        "teachers": db.execute("SELECT COUNT(*) FROM users WHERE role='teacher'").fetchone()[0],
        "courses": db.execute("SELECT COUNT(*) FROM courses").fetchone()[0],
        "enrollments": db.execute("SELECT COUNT(*) FROM enrollments").fetchone()[0],
    }
    courses = db.execute(
        """SELECT c.*, u.name AS teacher_name,
                  (SELECT COUNT(*) FROM enrollments e
                   WHERE e.course_id = c.course_id) AS enrolled_count
           FROM courses c JOIN users u ON u.user_id = c.teacher_id
           ORDER BY c.department, c.course_id""",
    ).fetchall()
    return render_template(
        "admin/home.html",
        user=user_of(db, session["user_id"]),
        counts=counts,
        courses=courses,
        semester=SEMESTER,
        weekday_names=WEEKDAYS,
    )


@app.route("/admin/users")
@role_required("admin")
def admin_users():
    db = get_db()
    users = db.execute(
        "SELECT * FROM users ORDER BY role, user_id"
    ).fetchall()
    return render_template(
        "admin/users.html",
        user=user_of(db, session["user_id"]),
        users=users,
    )


@app.route("/admin/users", methods=["POST"])
@role_required("admin")
def admin_add_user():
    user_id = request.form.get("user_id", "").strip()
    name = request.form.get("name", "").strip()
    password = request.form.get("password", "").strip()
    role = request.form.get("role", "student")
    department = request.form.get("department", "").strip()
    db = get_db()
    if not user_id or not name or not password:
        flash("帳號、姓名、密碼皆為必填", "error")
    elif db.execute("SELECT 1 FROM users WHERE user_id = ?", (user_id,)).fetchone():
        flash("該帳號已存在", "error")
    else:
        db.execute(
            "INSERT INTO users (user_id, password, name, role, department) VALUES (?,?,?,?,?)",
            (user_id, password, name, role, department),
        )
        db.commit()
        flash(f"已新增使用者 {name}", "success")
    return redirect(url_for("admin_users"))


@app.route("/admin/users/<user_id>/delete", methods=["POST"])
@role_required("admin")
def admin_delete_user(user_id):
    db = get_db()
    if user_id == session["user_id"]:
        flash("不能刪除自己的帳號", "error")
        return redirect(url_for("admin_users"))
    db.execute("DELETE FROM enrollments WHERE student_id = ?", (user_id,))
    db.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
    db.commit()
    flash("使用者已刪除", "success")
    return redirect(url_for("admin_users"))


@app.route("/admin/courses")
@role_required("admin")
def admin_courses():
    db = get_db()
    courses = db.execute(
        """SELECT c.*, u.name AS teacher_name,
                  (SELECT COUNT(*) FROM enrollments e
                   WHERE e.course_id = c.course_id) AS enrolled_count
           FROM courses c JOIN users u ON u.user_id = c.teacher_id
           ORDER BY c.course_id""",
    ).fetchall()
    teachers = db.execute(
        "SELECT user_id, name FROM users WHERE role='teacher' ORDER BY name"
    ).fetchall()
    return render_template(
        "admin/courses.html",
        user=user_of(db, session["user_id"]),
        courses=courses,
        teachers=teachers,
        weekday_names=WEEKDAYS,
    )


@app.route("/admin/courses", methods=["POST"])
@role_required("admin")
def admin_add_course():
    def _int(value, default=0):
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    course_id = request.form.get("course_id", "").strip()
    name = request.form.get("name", "").strip()
    department = request.form.get("department", "").strip()
    credits = _int(request.form.get("credits"))
    capacity = _int(request.form.get("capacity"), 60)
    teacher_id = request.form.get("teacher_id", "").strip()
    weekday = _int(request.form.get("weekday"))
    period = _int(request.form.get("period"))
    location = request.form.get("location", "").strip()
    db = get_db()
    if not course_id or not name or not department or not teacher_id:
        flash("開課代碼、課程名稱、開課單位、授課教師為必填", "error")
    elif db.execute("SELECT 1 FROM courses WHERE course_id = ?", (course_id,)).fetchone():
        flash("開課代碼已存在", "error")
    else:
        db.execute(
            """INSERT INTO courses
               (course_id, name, department, credits, capacity, teacher_id, weekday, period, location)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (course_id, name, department, credits, capacity, teacher_id, weekday, period, location),
        )
        db.commit()
        flash(f"已開設課程「{name}」", "success")
    return redirect(url_for("admin_courses"))


@app.route("/admin/courses/<course_id>/delete", methods=["POST"])
@role_required("admin")
def admin_delete_course(course_id):
    db = get_db()
    db.execute("DELETE FROM enrollments WHERE course_id = ?", (course_id,))
    db.execute("DELETE FROM courses WHERE course_id = ?", (course_id,))
    db.commit()
    flash("課程已刪除", "success")
    return redirect(url_for("admin_courses"))


@app.route("/admin/enrollments")
@role_required("admin")
def admin_enrollments():
    db = get_db()
    enrollments = db.execute(
        """SELECT e.id, e.semester, e.grade,
                  s.user_id AS student_id, s.name AS student_name, s.department AS stu_department,
                  c.course_id, c.name AS course_name, c.department, u.name AS teacher_name
           FROM enrollments e
           JOIN users s ON s.user_id = e.student_id
           JOIN courses c ON c.course_id = e.course_id
           JOIN users u ON u.user_id = c.teacher_id
           ORDER BY e.semester DESC, s.user_id""",
    ).fetchall()
    return render_template(
        "admin/enrollments.html",
        user=user_of(db, session["user_id"]),
        enrollments=enrollments,
    )


@app.route("/admin/enrollments/delete/<int:eid>", methods=["POST"])
@role_required("admin")
def admin_delete_enrollment(eid):
    db = get_db()
    db.execute("DELETE FROM enrollments WHERE id = ?", (eid,))
    db.commit()
    flash("選課紀錄已刪除", "success")
    return redirect(url_for("admin_enrollments"))


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)