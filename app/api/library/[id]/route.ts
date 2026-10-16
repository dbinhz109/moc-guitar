import { failure } from '../../../../lib/account';
import { deleteDocument, getDocument } from '../../../../lib/library';
export const dynamic='force-dynamic';
const id=(request:Request)=>new URL(request.url).pathname.split('/').pop()!;
export async function GET(request:Request){try{return await getDocument(request,id(request))}catch(e){return failure(e)}}
export async function DELETE(request:Request){try{return await deleteDocument(request,id(request))}catch(e){return failure(e)}}
