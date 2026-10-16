import { failure } from '../../../lib/account';
import { listDocuments, uploadDocument } from '../../../lib/library';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{return await listDocuments(request)}catch(e){return failure(e)}}
export async function POST(request:Request){try{return await uploadDocument(request)}catch(e){return failure(e)}}
