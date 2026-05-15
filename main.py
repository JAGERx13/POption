import os
import base64
import json
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
import uvicorn

from analyzer import analyze_chart

app = FastAPI(title="POption Signal Analyzer", version="1.0.0")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/analyze")
async def analyze(
    screenshot: UploadFile = File(...),
    timeframe: str = Form(...),
    api_key: str = Form(...),
):
    if timeframe not in ["2m", "5m", "10m"]:
        raise HTTPException(status_code=400, detail="Timeframe must be 2m, 5m, or 10m")

    if not api_key or not api_key.startswith("sk-ant-"):
        raise HTTPException(status_code=400, detail="Invalid Anthropic API key format")

    allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
    if screenshot.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Only PNG, JPG, and WebP images are supported",
        )

    image_bytes = await screenshot.read()
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 20MB)")

    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    media_type = screenshot.content_type

    result = await analyze_chart(image_b64, media_type, timeframe, api_key)
    return JSONResponse(content=result)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
