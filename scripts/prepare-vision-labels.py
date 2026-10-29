import json,re,base64,sys
import numpy as np
import onnxruntime as ort
from pathlib import Path
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path('vision-model-source');vocab=json.loads((root/'vocab.json').read_text());merges={tuple(line.split()):i for i,line in enumerate((root/'merges.txt').read_text().splitlines()[1:]) if len(line.split())==2}
def bpe(word):
 parts=tuple(word[:-1])+(word[-1]+'</w>',)
 while len(parts)>1:
  pairs=list(zip(parts,parts[1:]));pair=min(pairs,key=lambda p:merges.get(p,float('inf')))
  if pair not in merges:break
  out=[];i=0
  while i<len(parts):
   if i<len(parts)-1 and (parts[i],parts[i+1])==pair:out.append(parts[i]+parts[i+1]);i+=2
   else:out.append(parts[i]);i+=1
  parts=tuple(out)
 return [vocab[p] for p in parts]
def encode(text):
 ids=[49406]
 for word in re.findall(r'[a-z]+|[0-9]|[^\s\w]',text.lower()):ids+=bpe(word)
 ids=ids[:76]+[49407];return ids+[0]*(77-len(ids)),[1]*len(ids)+[0]*(77-len(ids))
groups={
 'scene': [('bar','bar / pub interior'),('restaurant','restaurant dining room'),('cafe','coffee shop interior'),('kitchen','kitchen interior'),('living room','living room interior'),('bedroom','bedroom interior'),('bathroom','bathroom interior'),('office','office interior'),('meeting room','corporate meeting room'),('warehouse','warehouse interior'),('industrial','industrial factory'),('shop','retail shop interior'),('hospital','hospital interior'),('classroom','school classroom'),('stadium','sports stadium'),('theatre','theater stage'),('studio','photography studio'),('hotel','hotel lobby'),('street','city street'),('village','rural village'),('building','building exterior'),('apartment','apartment interior'),('garden','garden'),('forest','forest'),('field','grass field'),('beach','beach'),('mountains','mountain landscape'),('lake','lake'),('swimming pool','swimming pool'),('parking','parking lot'),('rooftop','rooftop terrace'),('courtyard','building courtyard'),('graffiti','graffiti mural wall'),('bus','bus'),('car','car'),('truck','truck'),('motorcycle','motorcycle'),('bicycle','bicycle')],
 'object':[('chairs','chairs'),('tables','table'),('sofa','sofa'),('armchair','armchair'),('wooden furniture','wooden furniture'),('shelves','bookshelf'),('lamp','table lamp'),('chandelier','chandelier'),('plants','potted plants'),('mirror','mirror'),('curtains','curtains'),('carpet','carpet'),('bed','bed'),('bathtub','bathtub'),('sink','sink'),('stairs','stairs'),('windows','large windows'),('doors','door'),('fence','fence'),('piano','piano'),('guitar','guitar'),('bottles','glass bottles'),('glasses','drinking glasses'),('plates','plates'),('fruit','fruit'),('flowers','flowers'),('books','books'),('television','television'),('computer','computer'),('tools','tools'),('suitcase','suitcase')],
 'material':[('brick','exposed brick walls'),('concrete','concrete walls'),('wood','wood interior'),('glass','glass interior'),('metal','metal surfaces'),('stone','stone walls'),('marble','marble interior')],
 'style':[('modern','modern interior design'),('vintage','vintage interior design'),('rustic','rustic interior design'),('minimalist','minimalist interior design'),('luxurious','luxurious interior design')],
 'lighting':[('natural light','room with natural daylight'),('neon','room with neon lighting'),('warm light','room with warm lighting')]
}
translations={'bar':'Bar','restaurant':'Restorant','cafe':'Kafene','kitchen':'Kuzhinë','living room':'Dhomë ndenjeje','bedroom':'Dhomë gjumi','bathroom':'Banjo','office':'Zyrë','meeting room':'Sallë takimesh','warehouse':'Depo','industrial':'Industrial','shop':'Dyqan','hospital':'Spital','classroom':'Klasë','stadium':'Stadium','theatre':'Teatër','studio':'Studio','hotel':'Hotel','street':'Rrugë','village':'Fshat','building':'Ndërtesë','apartment':'Banesë','garden':'Kopsht','forest':'Pyll','field':'Fushë','beach':'Plazh','mountains':'Male','lake':'Liqen','swimming pool':'Pishinë','parking':'Parking','rooftop':'Tarracë','courtyard':'Oborr','graffiti':'Grafiti','bus':'Autobus','car':'Veturë','truck':'Kamion','motorcycle':'Motoçikletë','bicycle':'Biçikletë','chairs':'Karrige','tables':'Tavolina','sofa':'Divan','armchair':'Kolltuk','wooden furniture':'Mobilie druri','shelves':'Rafte','lamp':'Llambë','chandelier':'Llambadar','plants':'Bimë','mirror':'Pasqyrë','curtains':'Perde','carpet':'Qilim','bed':'Shtrat','bathtub':'Vaskë','sink':'Lavaman','stairs':'Shkallë','windows':'Dritare','doors':'Derë','fence':'Gardh','piano':'Piano','guitar':'Kitarë','bottles':'Shishe','glasses':'Gota','plates':'Pjata','fruit':'Fruta','flowers':'Lule','books':'Libra','television':'Televizor','computer':'Kompjuter','tools':'Vegla','suitcase':'Valixhe','brick':'Tulla','concrete':'Beton','wood':'Dru','glass':'Xham','metal':'Metal','stone':'Gur','marble':'Mermer','modern':'Modern','vintage':'Vintage','rustic':'Rustik','minimalist':'Minimalist','luxurious':'Luksoz','natural light':'Dritë natyrale','neon':'Neon','warm light':'Dritë e ngrohtë'}
s=ort.InferenceSession(str(root/'text.onnx'),providers=['CPUExecutionProvider']);labels=[];vectors=[]
for group,entries in groups.items():
 for key,description in entries:
  prompts=['a photo of a '+description+'.','a photograph of '+description+'.'];features=[]
  for prompt in prompts:
   ids,mask=encode(prompt);out=s.run(None,{'input_ids':np.array([ids],dtype=np.int32),'attention_mask':np.array([mask],dtype=np.int32)})[0][0];features.append(out/np.linalg.norm(out))
  vector=np.mean(features,axis=0);vector/=np.linalg.norm(vector);vectors.append(np.rint(vector*127).clip(-127,127).astype(np.int8));labels.append({'key':key,'tag':translations[key],'group':group})
output={'version':'clip-laion-v1','dimension':512,'labels':labels,'vectors':base64.b64encode(np.stack(vectors).tobytes()).decode()}
(Path(__file__).resolve().parent.parent/'public/vision-labels.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')))
print('Prepared',len(labels),'tag embeddings.')
