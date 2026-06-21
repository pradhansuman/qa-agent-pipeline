FROM mcr.microsoft.com/playwright:v1.44.0-jammy
WORKDIR /app

# python for the agents
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

COPY . .
# playwright browsers already in the base image
RUN npm i -D @playwright/test allure-playwright

ENTRYPOINT ["python3", "-m", "orchestrator.pipeline"]
