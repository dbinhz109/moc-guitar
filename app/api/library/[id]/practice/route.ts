import { failure } from '../../../../../lib/account';
import { updatePractice } from '../../../../../lib/library';
export const dynamic='force-dynamic';
export async function PUT(request:Request){try{return await updatePractice(request,new URL(request.url).pathname.split('/').at(-2)!)}catch(e){return failure(e)}}
