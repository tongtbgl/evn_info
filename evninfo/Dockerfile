FROM python:3.12-alpine
ENV PYTHONUNBUFFERED=1 TZ=Asia/Ho_Chi_Minh
RUN apk add --no-cache tzdata
WORKDIR /app
COPY app/ /app/
CMD ["python", "-u", "/app/main.py"]
