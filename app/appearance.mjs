export const defaultAppearance=Object.freeze({backgroundColor:'#14232e',lyricsColor:'#def4e7',opacity:.95,image:null,imageName:'',overlayColor:'black',overlayOpacity:0,textShadow:false});

export function validateAppearance(value){
  const fail=()=>{throw new Error('外观设置无效，请选择有效颜色、透明度或图片');};
  if(!value||typeof value!=='object'||Array.isArray(value))fail();
  const result={...defaultAppearance,...value};
  for(const key of ['backgroundColor','lyricsColor'])if(typeof result[key]!=='string'||!/^#[\da-f]{6}$/i.test(result[key]))fail();
  if(typeof result.opacity!=='number'||!Number.isFinite(result.opacity)||result.opacity<0||result.opacity>1)fail();
  if(!['black','white'].includes(result.overlayColor)||typeof result.overlayOpacity!=='number'||!Number.isFinite(result.overlayOpacity)||result.overlayOpacity<0||result.overlayOpacity>1||typeof result.textShadow!=='boolean')fail();
  if(result.image!==null){
    if(typeof result.image!=='string'||result.image.length>1400*1024||!/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(result.image))fail();
    const bytes=Buffer.from(result.image.split(',')[1],'base64');
    const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    if(result.image.startsWith('data:image/png')?!png:!jpeg)fail();
  }
  if(typeof result.imageName!=='string'||result.imageName.length>160)fail();
  result.imageName=result.image?result.imageName.replace(/[\x00-\x1f\x7f]/g,''):'';
  return Object.fromEntries(Object.keys(defaultAppearance).map(key=>[key,result[key]]));
}
