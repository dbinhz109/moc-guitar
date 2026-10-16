import { failure, saveProgress } from "../../../lib/account";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try{return await saveProgress(request)}catch(error){return failure(error)}
}
