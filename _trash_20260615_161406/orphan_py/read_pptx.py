import pptx
import sys

def read_pptx(file_path):
    try:
        prs = pptx.Presentation(file_path)
        with open("pptx_output.txt", "w", encoding="utf-8") as f:
            for i, slide in enumerate(prs.slides):
                f.write(f"--- Slide {i+1} ---\n")
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        f.write("- " + shape.text.replace('\n', ' ') + "\n")
                f.write("\n")
    except Exception as e:
        print(f"Error reading pptx: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        read_pptx(sys.argv[1])
    else:
        print("Please provide a file path")
