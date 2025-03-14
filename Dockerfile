# Use an official lightweight Node.js image as a base
FROM ghcr.io/puppeteer/puppeteer:23.8.0

# Switch to root user to install necessary packages and Bun
USER root

# Install necessary packages
RUN apt-get update && apt-get install -y \
    dnsutils \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Download and install dnsproxy
RUN wget https://github.com/AdguardTeam/dnsproxy/releases/download/v0.73.4/dnsproxy-linux-amd64-v0.73.4.tar.gz -O /tmp/dnsproxy.tar.gz \
    && mkdir /tmp/dnsproxy \
    && tar -xzf /tmp/dnsproxy.tar.gz -C /tmp/dnsproxy \
    && mv /tmp/dnsproxy/linux-amd64/dnsproxy /usr/local/bin/dnsproxy \
    && chmod +x /usr/local/bin/dnsproxy \
    && rm /tmp/dnsproxy.tar.gz \
    && rm -r /tmp/dnsproxy

# Install Bun (latest version) and move it to a globally accessible location
RUN curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun /usr/local/bun && \
    ln -s /usr/local/bun/bin/bun /usr/local/bin/bun

# Add Bun to the PATH
ENV PATH="/usr/local/bun/bin:$PATH"

# Set the working directory
WORKDIR /app

# Copy package.json and bun.lockb (if it exists)
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install

# Copy the rest of the application code
COPY . .

# Command to run when the container starts (optional)
CMD ["/bin/bash"]
