import fitz
import os

pdf_path = "attached_assets/عرض_سعر__2026-07-09_1783625957880.pdf"
out_dir = ".agents/outputs"
os.makedirs(out_dir, exist_ok=True)

doc = fitz.open(pdf_path)
print(f"Pages: {doc.page_count}")
print(f"Metadata: {doc.metadata}")

for i, page in enumerate(doc):
    print(f"\nPage {i+1}: {page.rect}")
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    out_path = f"{out_dir}/page_{i+1}.png"
    pix.save(out_path)
    print(f"  Saved: {out_path} ({pix.width}x{pix.height})")

doc.close()
print("Done.")
