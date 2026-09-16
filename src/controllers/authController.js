import bcrypt from 'bcryptjs'
import userModel from '../models/userModel.js'
import jwt from 'jsonwebtoken'
import transactionModel from '../models/transactionModel.js'
import { caseInsensitiveExact } from '../utils/regex.js'


export const signUpAction = async (req, res) => {
    const midtransUrl = process.env.MIDTRANS_URL
    const midtransAuthString = process.env.MIDTRANS_AUTH_STRING
    

    try {
        const body = req.body;

        // 🔒 Satu email hanya boleh punya satu akun (case-insensitive)
        const emailExists = await userModel.exists({
            email: caseInsensitiveExact(body.email),
        });

        if (emailExists) {
            return res.status(400).json({
                message: 'Email already registered'
            });
        }

        const hashPassword = bcrypt.hashSync(body.password, 12);

        const user = new userModel({
            name: body.name,
            email: body.email,
            photo: 'testing.png',
            password: hashPassword,
            role: 'manager'
        });

        // Harga paket manager: SEKALI BAYAR (tanpa masa aktif / tanpa perpanjangan).
        // Diambil dari env supaya tidak hardcode → lihat .env.example (MANAGER_PLAN_PRICE)
        const planPrice = Number(process.env.MANAGER_PLAN_PRICE ?? 200000);

        const transaction = new transactionModel({
            user: user._id,
            price: planPrice
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
        console.error(error);
        return res.status(500).json({
            message: 'Internal Server error'
        });
    }
}

export const signInAction  = async (req, res) => {

    try {
    const body = req.body

    // Case-insensitive supaya user lama yang emailnya tersimpan dengan huruf besar tetap bisa login
    const existingUser = await userModel.findOne({
        email: caseInsensitiveExact(body.email),
    })

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

    // Paket manager = SEKALI BAYAR (tanpa masa aktif / tanpa perpanjangan),
    // jadi cukup ada SATU transaksi sukses. Kalau nanti berubah jadi langganan
    // bulanan, tambahkan pengecekan masa aktif di sini.
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
     {
         expiresIn: '7 days',
         algorithm: 'HS256',
         // issuer/audience hanya ditambahkan kalau env-nya diset, supaya opt-in
         // dan tidak langsung membatalkan token lama.
         ...(process.env.JWT_ISSUER ? { issuer: process.env.JWT_ISSUER } : {}),
         ...(process.env.JWT_AUDIENCE ? { audience: process.env.JWT_AUDIENCE } : {}),
     }
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
        console.error(error);
        return res.status(500).json({
            message: 'Internal Server Error',
            error: process.env.NODE_ENV === "production" ? undefined : error.message,
        })
        
    }
}
