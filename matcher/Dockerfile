FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/app/.hf_cache

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the DINOv2 ONNX model into the image so no download happens at runtime
RUN python -c "from huggingface_hub import hf_hub_download; hf_hub_download(repo_id='onnx-community/dinov2-small', filename='onnx/model.onnx')"

COPY pagematch ./pagematch
COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
