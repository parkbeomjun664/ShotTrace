# 수집기 이미지 — "꺼지면 데이터를 잃는 프로그램" 이라 compose 가 띄운다 (ADR 011 · M28)
#
# 🔴 .env 를 여기 굽지 않는다. 이미지에 service_role 키가 박힌다
# 🔴 Dockerfile 은 줄 끝 주석을 모른다. # 는 줄 맨 앞에서만 주석이다 (YAML 과 다르다)

# 파이썬이 깔린 작은 리눅스. slim = 군더더기를 뺀 것
FROM python:3.12-slim

# 상자 안의 작업 폴더. 없으면 만들어 준다
WORKDIR /app

# 🔴 목록을 먼저 넣는다 — Docker 는 바뀐 층부터 다시 만든다
COPY requirements.txt .

# RUN = 틀을 만들 때 한 번 · --no-cache-dir = 설치 파일을 안 남긴다 (크기)
RUN pip install --no-cache-dir -r requirements.txt

# 자주 바뀌는 것을 뒤에 — 코드를 고쳐도 여기부터만 다시 만든다
COPY collector.py .

# CMD = 상자를 켤 때마다 실행. 브로커 주소는 compose 가 덮어쓴다
CMD ["python", "collector.py"]
