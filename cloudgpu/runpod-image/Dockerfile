FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
WORKDIR /workspace

RUN apt-get update && apt-get install -y \
    python3 python3-pip git wget curl \
    && ln -sf /usr/bin/python3 /usr/bin/python \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    torch==2.3.0 torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu121

RUN git clone https://github.com/comfyanonymous/ComfyUI.git /workspace/ComfyUI
RUN pip install --no-cache-dir -r /workspace/ComfyUI/requirements.txt

RUN git clone https://github.com/ltdrdata/ComfyUI-Manager.git \
    /workspace/ComfyUI/custom_nodes/ComfyUI-Manager && \
    pip install --no-cache-dir \
    -r /workspace/ComfyUI/custom_nodes/ComfyUI-Manager/requirements.txt

RUN mkdir -p \
    /workspace/ComfyUI/models/checkpoints \
    /workspace/ComfyUI/models/vae \
    /workspace/ComfyUI/models/clip \
    /workspace/ComfyUI/models/loras \
    /workspace/ComfyUI/output \
    /workspace/ComfyUI/user/default/workflows

RUN wget -q -O /workspace/ComfyUI/models/vae/sdxl_vae.safetensors \
    "https://huggingface.co/madebyollin/sdxl-vae-fp16-fix/resolve/main/sdxl_vae.safetensors"

COPY startup.sh /startup.sh
RUN chmod +x /startup.sh

EXPOSE 8188
CMD ["/startup.sh"]
