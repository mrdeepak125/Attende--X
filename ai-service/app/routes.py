from fastapi import APIRouter, UploadFile, File
from app.face_service import verify_face

router = APIRouter()

@router.post("/verify-face")
async def verify(live_image: UploadFile = File(...),
                 original_image: UploadFile = File(...)):
    
    result = await verify_face(live_image, original_image)
    return result