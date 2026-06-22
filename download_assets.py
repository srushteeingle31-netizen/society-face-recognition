import os
import urllib.request
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

BASE_DIR = os.getcwd()
JS_DIR = os.path.join(BASE_DIR, 'public', 'js')
MODELS_DIR = os.path.join(BASE_DIR, 'public', 'models')

# Create directories
os.makedirs(JS_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

ASSETS = [
    # Script
    {
        "url": "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/dist/face-api.js",
        "dest": os.path.join(JS_DIR, "face-api.js")
    },
    # WASM Fallback Binaries (from @tensorflow/tfjs-backend-wasm@4.22.0 to match face-api's bundled TFJS version 4.22.0)
    {
        "url": "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/tfjs-backend-wasm.wasm",
        "dest": os.path.join(JS_DIR, "tfjs-backend-wasm.wasm")
    },
    {
        "url": "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/tfjs-backend-wasm-simd.wasm",
        "dest": os.path.join(JS_DIR, "tfjs-backend-wasm-simd.wasm")
    },
    {
        "url": "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.22.0/dist/tfjs-backend-wasm-threaded.wasm",
        "dest": os.path.join(JS_DIR, "tfjs-backend-wasm-threaded.wasm")
    },
    # Tiny Face Detector model
    {
        "url": "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/tiny_face_detector_model-weights_manifest.json",
        "dest": os.path.join(MODELS_DIR, "tiny_face_detector_model-weights_manifest.json")
    },
    {
        "url": "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/tiny_face_detector_model.bin",
        "dest": os.path.join(MODELS_DIR, "tiny_face_detector_model.bin")
    },
    # Face Landmark 68 model
    {
        "url": "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_landmark_68_model-weights_manifest.json",
        "dest": os.path.join(MODELS_DIR, "face_landmark_68_model-weights_manifest.json")
    },
    {
        "url": "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_landmark_68_model.bin",
        "dest": os.path.join(MODELS_DIR, "face_landmark_68_model.bin")
    },
    # Face Recognition model
    {
        "url": "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_recognition_model-weights_manifest.json",
        "dest": os.path.join(MODELS_DIR, "face_recognition_model-weights_manifest.json")
    },
    {
        "url": "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/face_recognition_model.bin",
        "dest": os.path.join(MODELS_DIR, "face_recognition_model.bin")
    }
]

print("Starting asset downloads...")
for asset in ASSETS:
    url = asset["url"]
    dest = asset["dest"]
    filename = os.path.basename(dest)
    print(f"Downloading {filename}...")
    try:
        # Avoid re-downloading large .bin files if they already exist
        if os.path.exists(dest) and dest.endswith('.bin'):
            print(f"File {filename} already exists, skipping.")
            continue
        urllib.request.urlretrieve(url, dest)
        print(f"Saved {filename} successfully")
    except Exception as e:
        print(f"Failed to download {filename}: {e}")

print("Asset downloads completed.")
