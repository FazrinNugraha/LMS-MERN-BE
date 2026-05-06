import bcrypt from 'bcryptjs'
import userModel from '../models/userModel.js'
import TransactionModel from '../models/transactionModel.js'
import jwt from 'jsonwebtoken'
import transactionModel from '../models/transactionModel.js'


export const signUpAction = async (req, res) => {
    const midtransUrl = process.env.MIDTRANS_URL
    const midtransAuthString = process.env.MIDTRANS_AUTH_STRING
    

    try {
        const body = req.body;

        const hashPassword = bcrypt.hashSync(body.password, 12);

        const user = new userModel({
            name: body.name,
            email: body.email,
            photo: 'testing.png',
            password: hashPassword,
            role: 'manager'
        });

        const transaction = new TransactionModel({
            user: user._id,
            price: 200000
        });

        const midtrans = await fetch(midtransUrl, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                 Authorization : `Basic ${midtransAuthString}` // ✅ pakai hasil encode
            },
            body: JSON.stringify({
                transaction_details: {
                    order_id: transaction._id.toString(),
                    gross_amount: transaction.price
                },
                credit_card: {
                    secure: true
                },
                customer_details: {
                    email: user.email,
                },
                callbacks: {
                    finish: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/success-checkout`
                }
            })
        });

        const resMidtrans = await midtrans.json()

        await user.save();
        await transaction.save();

        return res.json({
            message: 'Sign Up Success',
            data: {
                midtrans_payment_url: resMidtrans?.redirect_url 
            }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Internal Server error'
        });
    }
}

export const signInAction  = async (req, res) => {

    try {
    const body = req.body

    const existingUser = await userModel
    .findOne()
    .where('email')
    .equals(body.email)

    if (!existingUser) {
        return res.status(400).json({
            message: 'User not found'
        })
    }

    const comparePassword = bcrypt.compareSync(
        body.password,
        existingUser.password
    )

    if (!comparePassword) {
        return res.status(400).json({
            message: 'Email or Password incorrect'
        })       
    }

    const isvalidUser = await transactionModel.findOne({
        user: existingUser._id,
        status: 'succses'
    })

    if (existingUser.role !== 'student' && !isvalidUser) {
        return res.status(400).json({
            message:'User not verrified'
        })   
    }

    const token  = jwt.sign(
        {
            data: {
                id: existingUser._id.toString()
            }
     },

     process.env.SECRET_KEY_JWT,
     {expiresIn: '7 days'}
)

    return res.json({
        message: 'User logged in success',
        data :{
            name: existingUser.name,
            email: existingUser.email,
            photo: existingUser.photo,
            token,
            role: existingUser.role
        }
    })
        
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: 'Internal Server Error',
            error: error.message
        })
        
    }
}
