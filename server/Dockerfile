FROM rust:slim-bookworm AS dwg2pdf-build
RUN apt-get update && apt-get install -y --no-install-recommends \
      git build-essential pkg-config ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /dwg2pdf
COPY dwg2pdf/Cargo.toml dwg2pdf/Cargo.lock ./
COPY dwg2pdf/src ./src
RUN cargo build --release

FROM golang
WORKDIR /app
# DejaVu/Liberation give dwg2pdf a TTF to embed for non-Latin (Cyrillic) text
RUN apt-get update && apt-get install -y --no-install-recommends \
      fonts-dejavu-core fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
RUN go install github.com/air-verse/air@latest
COPY --from=dwg2pdf-build /dwg2pdf/target/release/dwg2pdf /usr/local/bin/dwg2pdf
COPY server/go.mod server/go.sum ./

RUN go mod download


# COPY . .
CMD [ "air", "-c", ".air.toml" ]
# CMD [ "air" ]
