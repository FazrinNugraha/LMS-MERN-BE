import { ZodError } from "zod"

export const validateRequest = (schema) => async (req, res, next) => {
    try {
        schema.parse(req.body)
        next()
    } catch (error) {
        if (error instanceof ZodError){
            const errorMessage = error.issues.map((err => err.message));

            return res.status(400).json({ error: 'Invalid Request', details: errorMessage })

          
        }
          return res.status(500).json({ error: 'Internal Server Error' })
        
    }
}