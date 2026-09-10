import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { analytics } from '../services/analyticsService.js';
const router=Router();
router.use(requireAuth);
router.use((req,res,next)=>['ADMIN','SUPER_ADMIN'].includes(req.user.role)?next():res.status(403).json({error:'Analytics requires an administrator account.'}));
router.get('/overview',async(req,res,next)=>{
  try { res.set('Cache-Control','no-store').json(await analytics(req.query)); }
  catch(error){ if(error.status===400)return res.status(400).json({error:error.message});next(error); }
});
export default router;
