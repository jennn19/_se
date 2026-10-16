use axum::{
    extract::Path,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct Info {
    service: &'static str,
    language: &'static str,
    version: &'static str,
    description: &'static str,
}

#[derive(Serialize)]
struct PrimeResult {
    number: u64,
    is_prime: bool,
}

#[derive(Serialize)]
struct FibResult {
    n: u32,
    value: u128,
    elapsed_micros: u128,
}

#[derive(Deserialize)]
struct ComputeRequest {
    n: u64,
}

async fn health() -> impl IntoResponse {
    Json(serde_json::json!({
        "service": "rust-api",
        "status": "ok",
        "language": "Rust"
    }))
}

async fn info() -> impl IntoResponse {
    Json(Info {
        service: "rust-api",
        language: "Rust",
        version: env!("CARGO_PKG_VERSION"),
        description: "高效能運算微服務（質數判斷 / 費氏數列）",
    })
}

fn is_prime(n: u64) -> bool {
    if n < 2 {
        return false;
    }
    if n % 2 == 0 {
        return n == 2;
    }
    let mut i = 3;
    while i * i <= n {
        if n % i == 0 {
            return false;
        }
        i += 2;
    }
    true
}

async fn prime(Path(number): Path<u64>) -> impl IntoResponse {
    Json(PrimeResult {
        number,
        is_prime: is_prime(number),
    })
}

async fn prime_post(Json(req): Json<ComputeRequest>) -> impl IntoResponse {
    Json(PrimeResult {
        number: req.n,
        is_prime: is_prime(req.n),
    })
}

fn fib(n: u32) -> u128 {
    let (mut a, mut b) = (0u128, 1u128);
    for _ in 0..n {
        let tmp = a + b;
        a = b;
        b = tmp;
    }
    a
}

async fn fibonacci(Path(n): Path<u32>) -> impl IntoResponse {
    if n > 186 {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "n 最大為 186" })),
        )
            .into_response();
    }
    let start = std::time::Instant::now();
    let value = fib(n);
    let elapsed = start.elapsed().as_micros();
    Json(FibResult {
        n,
        value,
        elapsed_micros: elapsed,
    })
    .into_response()
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/health", get(health))
        .route("/api/info", get(info))
        .route("/api/prime/:number", get(prime))
        .route("/api/prime", post(prime_post))
        .route("/api/fibonacci/:n", get(fibonacci));

    let addr = "0.0.0.0:3001";
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    println!("[rust-api] 監聽 http://{}", addr);
    axum::serve(listener, app).await.unwrap();
}
