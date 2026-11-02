import {readFile,mkdir,rename,writeFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join,basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const candidates=[
 ['client/src/assets/hero.png','881ffbcaafc212e49addad08846a5b82761355fa20624253af3477ba33262c5c'],
 ['client/src/assets/react.svg','35ef61ed53b323ae94a16a8ec659b3d0af3880698791133f23b084085ab1c2e5'],
 ['client/src/assets/vite.svg','5be21acd42eb7b896e517f4e0f0f11eb5c5d9e54fbbcebe9453f033008fcca6f'],
 ['client/src/components/RoutingCheck.jsx','8cf47ae5fead701d8f6f7c3a7efde3a3db696bdd6347d881c44ae65da1bcaf4f'],
 ['server/scripts/check-routing.js','f3922684298064c76bad6692869c98d19d9d474196ad3300fa85c2ad6601e230'],
 ['server/scripts/check-avoidance.js','ee35b043c51e6eb4406f0b6d479946555dcc211a32bd89ee7b3aa5e04e14c468']
];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function exists(path){try{return await lstat(path);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function main(){
 const args=process.argv.slice(2);
 if(args.some(x=>x!=='--apply'))throw new Error('Chỉ dùng không tham số để xem trước, hoặc --apply để chuyển file.');
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
 const pkg=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
 if(pkg.name!=='hanoi-flood-routing')throw new Error('Không ở đúng cấu trúc repo hanoi-flood-routing');
 const files=[];
 for(const [path,expected] of candidates){
  const source=join(root,path),stat=await exists(source);
  if(!stat){console.log('BỎ QUA — không tồn tại:',path);continue;}
  if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Không phải file thường: '+path);
  if(hash(await readFile(source))!==expected)throw new Error('File đã thay đổi so với ZIP được rà soát; không chuyển: '+path);
  files.push({path,sha256:expected});
 }
 console.log('Các file sẽ chuyển ra ngoài repo:');files.forEach(f=>console.log('  '+f.path));
 if(!args.includes('--apply')){console.log('ĐANG XEM TRƯỚC, chưa chuyển file. Thêm --apply để thực hiện.');return;}
 if(!files.length){console.log('Không còn file trong danh sách cần chuyển.');return;}
 const destination=join(dirname(root),basename(root)+'-archive',new Date().toISOString().replace(/[:.]/g,'-'));
 await mkdir(destination,{recursive:true});
 const manifest={repository:root,archive:destination,files,completed:[]};
 const manifestPath=join(destination,'archive-manifest.json');
 await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 for(const file of files){
  const source=join(root,file.path),target=join(destination,file.path);
  // Check again immediately before each mutation. Nothing is overwritten.
  if(hash(await readFile(source))!==file.sha256)throw new Error('File vừa thay đổi, dừng tại: '+file.path);
  if(await exists(target))throw new Error('Đích đã tồn tại: '+target);
  await mkdir(dirname(target),{recursive:true});await rename(source,target);
  manifest.completed.push(file.path);await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 }
 console.log('Đã chuyển',manifest.completed.length,'file. Bản lưu:',destination);
 console.log('Khôi phục: chuyển các file trong bản lưu về đúng đường dẫn tương đối trong repo.');
}
main().catch(e=>{console.error('LỖI:',e.message);process.exitCode=1;});
