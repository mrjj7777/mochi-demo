from PIL import Image
im=Image.open('_qa/after-s3/lookbook-1440.png')
im.crop((0,400,1440,2680)).save('_qa/after-s3/lookbook-1440-crop.png')
