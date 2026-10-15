import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "nqu.db")

SEMESTER = "113學年度 第2學期"

USERS = [
    # 學生
    ("D10911101", "1234", "林小青蛙", "student", "資訊工程學系"),
    ("D10911102", "1234", "陳大熊", "student", "資訊工程學系"),
    ("D10911103", "1234", "黃小鯨", "student", "資訊工程學系"),
    ("D11022201", "1234", "吳小兔", "student", "企業管理學系"),
    ("D11022202", "1234", "劉小鹿", "student", "企業管理學系"),
    ("D10833301", "1234", "張小貓", "student", "應用英語學系"),
    ("D10833302", "1234", "李小狗", "student", "應用英語學系"),
    ("D10944401", "1234", "陳小魚", "student", "護理學系"),
    ("D11055501", "1234", "王小鳥", "student", "建築學系"),
    # 教師
    ("T001", "8888", "教授 王國明", "teacher", "資訊工程學系"),
    ("T002", "8888", "教授 李慧珍", "teacher", "資訊工程學系"),
    ("T003", "8888", "副教授 張立德", "teacher", "企業管理學系"),
    ("T004", "8888", "助理教授 許雅婷", "teacher", "應用英語學系"),
    ("T005", "8888", "教授 陳志豪", "teacher", "護理學系"),
    # 行政
    ("admin", "admin", "行政助理 系統管理員", "admin", "教務處"),
]

COURSES = [
    # course_id, 名稱, 單位, 學分, 人數上限, 教師, 星期, 節次, 教室
    ("CS1001", "程式設計", "資訊工程學系", 3, 60, "T001", 1, 3, "A-101"),
    ("CS2001", "資料結構", "資訊工程學系", 3, 50, "T001", 3, 2, "A-203"),
    ("CS2002", "作業系統", "資訊工程學系", 3, 45, "T002", 2, 5, "A-305"),
    ("CS3001", "資料庫系統", "資訊工程學系", 3, 40, "T002", 4, 6, "A-305"),
    ("BA1001", "管理學", "企業管理學系", 2, 70, "T003", 1, 1, "B-102"),
    ("BA2001", "行銷管理", "企業管理學系", 2, 55, "T003", 5, 2, "B-201"),
    ("EL1001", "英文聽講", "應用英語學系", 2, 40, "T004", 2, 3, "C-103"),
    ("EL2001", "英語語言學概論", "應用英語學系", 3, 35, "T004", 4, 3, "C-205"),
    ("NS2001", "護理學概論", "護理學系", 3, 50, "T005", 3, 5, "D-101"),
    ("GE1001", "體育一", "通識教育中心", 1, 100, "T003", 5, 8, "體育館"),
]

ENROLLMENTS = [
    ("D10911101", "CS1001", 88),
    ("D10911101", "CS2001", 82),
    ("D10911101", "CS2002", None),
    ("D10911101", "GE1001", 90),
    ("D10911102", "CS1001", 75),
    ("D10911102", "CS2002", 91),
    ("D10911102", "BA1001", None),
    ("D10911103", "CS2001", 68),
    ("D10911103", "CS3001", 79),
    ("D11022201", "BA1001", 86),
    ("D11022201", "BA2001", None),
    ("D11022202", "BA1001", 72),
    ("D11022202", "CS1001", None),
    ("D10833301", "EL1001", 95),
    ("D10833301", "EL2001", 88),
    ("D10833302", "EL1001", 81),
    ("D10833302", "GE1001", None),
    ("D10944401", "NS2001", 77),
    ("D11055501", "GE1001", 92),
]


def init():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("""CREATE TABLE IF NOT EXISTS users (
        user_id    TEXT PRIMARY KEY,
        password   TEXT NOT NULL,
        name       TEXT NOT NULL,
        role       TEXT NOT NULL CHECK (role IN ('student','teacher','admin')),
        department TEXT
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS courses (
        course_id  TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        department TEXT,
        credits    INTEGER DEFAULT 0,
        capacity   INTEGER DEFAULT 60,
        teacher_id TEXT,
        weekday    INTEGER DEFAULT 1,
        period     INTEGER DEFAULT 1,
        location   TEXT,
        UNIQUE (course_id, teacher_id),
        FOREIGN KEY (teacher_id) REFERENCES users(user_id)
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS enrollments (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id TEXT,
        course_id  TEXT,
        semester   TEXT,
        grade      REAL,
        UNIQUE (student_id, course_id, semester),
        FOREIGN KEY (student_id) REFERENCES users(user_id),
        FOREIGN KEY (course_id)  REFERENCES courses(course_id)
    )""")

    c.executemany(
        "INSERT INTO users (user_id, password, name, role, department) VALUES (?,?,?,?,?)",
        USERS,
    )
    c.executemany(
        "INSERT INTO courses (course_id, name, department, credits, capacity, teacher_id, weekday, period, location) VALUES (?,?,?,?,?,?,?,?,?)",
        COURSES,
    )
    c.executemany(
        "INSERT INTO enrollments (student_id, course_id, semester, grade) VALUES (?,?,?,?)",
        [(s, co, SEMESTER, g) for s, co, g in ENROLLMENTS],
    )

    conn.commit()
    conn.close()
    print(f"資料庫已建立: {DB_PATH}")
    print(f"共 {len(USERS)} 位使用者, {len(COURSES)} 門課程, {len(ENROLLMENTS)} 筆選課紀錄")


if __name__ == "__main__":
    init()