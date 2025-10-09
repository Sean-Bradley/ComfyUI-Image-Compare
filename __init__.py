from PIL import Image
import numpy
import io
import base64


class ImageCompareNode:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image_a": ("IMAGE",),
                "image_b": ("IMAGE",),
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "compare"
    CATEGORY = "SBCODE"
    OUTPUT_NODE = True

    def compare(self, image_a, image_b):
        if image_a is None or len(image_a) == 0:
            return {}
        if image_b is None or len(image_b) == 0:
            return {}

        def tensor_to_pil(img_tensor):
            img = (img_tensor[0].cpu().numpy() *
                   255).clip(0, 255).astype(numpy.uint8)
            return Image.fromarray(img)

        pil_imgA = tensor_to_pil(image_a)
        pil_imgB = tensor_to_pil(image_b)

        imgA_b64 = self.pil_to_base64(pil_imgA)
        imgB_b64 = self.pil_to_base64(pil_imgB)

        print("Encoded base64 images generated.")

        return {
            "ui": {
                "b64_a": imgA_b64,
                "b64_b": imgB_b64,
            }
        }

    @staticmethod
    def pil_to_base64(img: Image.Image):
        """Convert PIL image to base64 for sending to JS"""
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{encoded}"


NODE_CLASS_MAPPINGS = {"ImageCompareNode": ImageCompareNode}
NODE_DISPLAY_NAME_MAPPINGS = {"ImageCompareNode": "Image Compare"}

WEB_DIRECTORY = "."

__all__ = ["NODE_CLASS_MAPPINGS", "WEB_DIRECTORY"]
