#!/bin/bash
# Download BRouter segment files for a specific region
# Usage: ./download-segments.sh [region]
# Regions: germany, europe, world

set -e

SEGMENTS_URL="https://brouter.de/brouter/segments4"
OUTPUT_DIR="./data/segments4"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Germany and surrounding area (Central Europe)
GERMANY_SEGMENTS=(
    "E5_N45.rd5"
    "E5_N50.rd5"
    "E10_N45.rd5"
    "E10_N50.rd5"
    "E15_N45.rd5"
    "E15_N50.rd5"
    "E0_N45.rd5"
    "E0_N50.rd5"
)

# Download function
download_segment() {
    local segment=$1
    local url="${SEGMENTS_URL}/${segment}"
    local output="${OUTPUT_DIR}/${segment}"

    if [ -f "$output" ]; then
        echo "Skipping $segment (already exists)"
    else
        echo "Downloading $segment..."
        curl -L -o "$output" "$url" || echo "Failed to download $segment"
    fi
}

echo "=== BRouter Segment Downloader ==="
echo "Output directory: $OUTPUT_DIR"
echo ""

case "${1:-germany}" in
    germany)
        echo "Downloading Germany region segments..."
        for segment in "${GERMANY_SEGMENTS[@]}"; do
            download_segment "$segment"
        done
        ;;
    *)
        echo "Unknown region: $1"
        echo "Available regions: germany"
        exit 1
        ;;
esac

echo ""
echo "Done! Segment files are in $OUTPUT_DIR"
echo ""
echo "To start BRouter:"
echo "  docker-compose -f docker-compose.dev.yml up"
