import shutil
import os
import face_recognition
import numpy as np

UPLOAD_DIR = "temp"
os.makedirs(UPLOAD_DIR, exist_ok=True)

async def verify_face(live_image, original_image):

    live_path = f"{UPLOAD_DIR}/live.jpg"
    original_path = f"{UPLOAD_DIR}/original.jpg"

    with open(live_path, "wb") as buffer:
        shutil.copyfileobj(live_image.file, buffer)

    with open(original_path, "wb") as buffer:
        shutil.copyfileobj(original_image.file, buffer)

    try:
        # Load images
        live_img = face_recognition.load_image_file(live_path)
        original_img = face_recognition.load_image_file(original_path)

        # Extract encodings
        live_encodings = face_recognition.face_encodings(live_img)
        original_encodings = face_recognition.face_encodings(original_img)

        # Face count check
        if len(live_encodings) == 0:
            return {"status": "absent", "reason": "No face detected"}

        if len(live_encodings) > 1:
            return {"status": "absent", "reason": "Multiple faces detected"}

        if len(original_encodings) == 0:
            return {"status": "absent", "reason": "No face in original image"}

        # Compare faces
        match = face_recognition.compare_faces(
            [original_encodings[0]],
            live_encodings[0],
            tolerance=0.5   # lower = stricter
        )

        if match[0]:
            return {"status": "present"}
        else:
            return {"status": "absent", "reason": "Face mismatch"}

    except Exception as e:
        return {"status": "absent", "reason": str(e)}