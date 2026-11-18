from PIL import Image
for f in ['lookbook-1440.png','lookbook-390.png','page-1440.png']:
 im=Image.open('_qa/after-s3/'+f); print(f,im.size)
