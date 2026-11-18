
from pathlib import Path
p = Path(r'C:\Users\mrjj7\Desktop\Portfolio-Demo-Sites\mochi-landing\src\App.tsx')
s = p.read_text(encoding='utf-8')
repls = {
'section id="squeeze" className="squeeze section section--squeeze" ref={ref}': 'section id="squeeze" className="squeeze section section--squeeze" ref={ref} data-aura="#2FA4A8,#F2EDE4"',
'section id="flavours" className="flavours section" ref={sectionRef}': 'section id="flavours" className="flavours section" ref={sectionRef} data-aura="#F2EDE4,#F2EDE4"',
'section id="texture" className="texture section" onPointerMove': 'section id="texture" className="texture section" data-aura="#8FC3E6,#F4A27E" onPointerMove',
'section id="lookbook" className="lookbook section" ref={ref}': 'section id="lookbook" className="lookbook section" ref={ref} data-aura="#F2EDE4,#F6D3D6"',
'section id="stand" className="stand section"': 'section id="stand" className="stand section" data-aura="#8FC3E6,#F2EDE4"',
'section id="all-six" className="all-six section"': 'section id="all-six" className="all-six section" data-aura="#E46A8E,#F2B632"',
'section id="wallpapers" className="wallpapers section"': 'section id="wallpapers" className="wallpapers section" data-aura="#2346B8,#F2EDE4"',
'footer className="footer section"': 'footer className="footer section" data-aura="#2346B8,#B3122E"',
}
for a,b in repls.items():
    if a not in s:
        print('missing', a)
    s = s.replace(a,b,1)
p.write_text(s, encoding='utf-8')

