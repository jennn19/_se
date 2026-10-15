# 金大校務系統（NQU 校務行政資訊系統）

模仿金門大學校務系統的教學專案，使用 **Python Flask + SQLite** 開發，
提供學生、教師、行政人員三種身分的校務操作功能。

## 功能總覽

| 身分別 | 功能 |
| ------ | ---- |
| 學生 | 線上選課 / 退選、時間衝突檢查、名額控管、我的課表、歷年成績與 GPA |
| 教師 | 我的授課列表與課表、修課學生名單、線上登錄成績 |
| 行政 | 系統統計總覽、使用者管理、開課 / 刪課管理、全校選課紀錄 |

## 開始使用

### 1. 環境需求
- Python 3.10+

### 2. 安裝相依套件
```bash
pip install -r requirements.txt
```

### 3. 初始化資料庫（建立範例資料）
```bash
python init_db.py
```
會在資料夾內產生 `nqu.db`，包含 15 位使用者、10 門課程、19 筆選課範例。

### 4. 啟動系統
```bash
python app.py
```
開啟瀏覽器連到 **http://127.0.0.1:5000**

> 若需重置資料，重新執行 `python init_db.py` 即可。

## 測試帳號

| 身分別 | 帳號 | 密碼 |
| ------ | ---- | ---- |
| 學生 | `D10911101` | `1234` |
| 教師 | `T001` | `8888` |
| 行政 | `admin` | `admin` |

其他學生帳號：`D10911102`、`D10911103`、`D11022201`、`D11022202`、`D10833301`、`D10833302`、`D10944401`、`D11055501`
其他教師帳號：`T002`～`T005`（密碼皆為 `8888`）

## 專案結構

```
sp/
├── app.py              # Flask 主程式（所有路由與商業邏輯）
├── init_db.py          # 建立 SQLite 資料庫與範例資料
├── nqu.db              # SQLite 資料庫（執行 init_db.py 產生）
├── requirements.txt
├── templates/
│   ├── base.html       # 共用版型（頂欄、導覽、flash 訊息）
│   ├── login.html      # 登入頁（含身分別選擇）
│   ├── student/        # 學生端：首頁、選課、課表、成績
│   ├── teacher/        # 教師端：首頁、課程名單與成績登錄
│   └── admin/          # 行政端：總覽、使用者、課程、選課紀錄
└── static/
    └── css/style.css   # 全站樣式
```

## 資料表設計

- **users**：`user_id`、`password`、`name`、`role`（student/teacher/admin）、`department`
- **courses**：`course_id`、`name`、`department`、`credits`、`capacity`、`teacher_id`、`weekday`、`period`、`location`
- **enrollments**：`student_id`、`course_id`、`semester`、`grade`（唯一鍵避免重複選課）

## 主要規則
- 選課時自動檢查：人數是否額滿、是否與既有課程時間衝突、是否重複選課。
- 已評分（有成績）的課程不可退選。
- 依權限（角色）控管路由，無權限存取會導回各自首頁。

> 本專案僅供學習與教學示範，不作為正式校務系統使用。