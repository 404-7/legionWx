"""Extract original workbook values with row provenance; never edits the source."""
import sys, os, json, hashlib
from pathlib import Path
sys.path.insert(0, str(Path(os.environ['TEMP'])/'legion-xls-reader'))
import xlrd

source=Path(sys.argv[1])
book=xlrd.open_workbook(str(source))
sheet=book.sheet_by_name('Unit stat')
fields=['sort','name','cost','total','food','range','interval','min','max','dps','hp','armor','attack','ability']
units=[]
for row in range(1,sheet.nrows):
    data={key:(value.strip() if isinstance(value,str) else value) for key,value in zip(fields,sheet.row_values(row))}
    data['row']=row+1
    units.append(data)
sheet=book.sheet_by_name('Level Bounty')
fields=['level','bounty','qty','creepGold','bonus','waveGold','totalGold','value']
waves=[dict(zip(fields,sheet.row_values(row))) for row in range(1,sheet.nrows)]
out=Path('data/legion341-sheet.json');out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps({'file':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'units':units,'waves':waves},ensure_ascii=False,indent=2),encoding='utf-8')
print('Imported',len(units),'unit rows and',len(waves),'wave rows into',out)
