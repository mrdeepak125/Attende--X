from deepface import DeepFace
import shutil
import os

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
        # Face Count Check
        faces = DeepFace.extract_faces(live_path, enforce_detection=False)

        if len(faces) == 0:
            return {"status": "absent", "reason": "No face detected"}

        if len(faces) > 1:
            return {"status": "absent", "reason": "Multiple faces detected"}

        # Face Verification
        result = DeepFace.verify(
            img1_path=live_path,
            img2_path=original_path,
            model_name="Facenet"
        )

        if result["verified"]:
            return {"status": "present"}
        else:
            return {"status": "absent", "reason": "Face mismatch"}

    except Exception as e:
        return {"status": "absent", "reason": "Error processing image"}