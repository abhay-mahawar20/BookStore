require('dotenv').config();

const fs = require('fs');
const path = require('path');

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "1234";


const express = require('express')
const app = express()
const port = 3000
const publicDir = path.join(__dirname, 'public')
const uploadsDir = path.join(publicDir, 'uploads')

const mongooes = require('mongoose')
const multer = require('multer');
const nodemailer = require('nodemailer');
const session = require('express-session');

const bookImageByTitle = [
    { title: 'atomic habit', image: '/uploads/HP.jpg' },
    { title: 'the alchemist', image: '/uploads/1790270705283-s.jpg' },
    { title: 'clean code', image: '/clean-code-cover.svg' },
    { title: 'harry potter', image: '/uploads/AH.jpg' },
    { title: 'lord of the rings', image: '/img3.png' },
    { title: 'lords of the rings', image: '/img3.png' },
    { title: 'song of ice and fire', image: '/img4.png' },
    { title: 'magician', image: '/AH.png' },
    { title: 'the hobbit', image: '/uploads/1790874952976-a.webp' },
    { title: 'the name of the wind', image: '/the-way-of-kings-cover.svg' },
    { title: 'the way of kings', image: '/the-name-of-the-wind-cover.svg' },
    { title: 'the first law', image: '/the-first-law-cover.svg' },
    { title: 'american gods', image: '/american-gods-cover.svg' },
    { title: 'wheel of time', image: '/the-wheel-of-time-cover.svg' }
];

function normalizeBookImage(book) {
    if (!book) return book;

    const normalizedTitle = String(book.title || '').toLowerCase();
    const matchingCover = bookImageByTitle.find(({ title }) => normalizedTitle.includes(title));
    if (matchingCover && fs.existsSync(path.join(publicDir, matchingCover.image.slice(1)))) {
        book.img = matchingCover.image;
        return book;
    }

    const imgPath = typeof book.img === 'string' ? book.img.trim() : '';
    if (!imgPath) {
        book.img = '/default-book-cover.svg';
        return book;
    }

    if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) {
        book.img = imgPath;
        return book;
    }

    const cleanedPath = imgPath.replace(/^\/+/, '');
    if (imgPath.startsWith('/')) {
        if (fs.existsSync(path.join(publicDir, imgPath.replace(/^\//, '')))) {
            book.img = imgPath;
            return book;
        }
    }

    const uploadCandidate = path.join(publicDir, 'uploads', cleanedPath);
    const rootCandidate = path.join(publicDir, cleanedPath);

    if (fs.existsSync(uploadCandidate)) {
        book.img = '/' + path.posix.join('uploads', cleanedPath.replace(/\\/g, '/')).replace(/^\/+/,'');
        return book;
    }

    if (fs.existsSync(rootCandidate)) {
        book.img = '/' + cleanedPath.replace(/\\/g, '/');
        return book;
    }

    book.img = '/default-book-cover.svg';
    return book;
}

async function seedBooks() {
    const count = await Book.countDocuments();

    if (count === 0) {
        await Book.insertMany([
            {
                title: 'The Alchemist',
                author: 'Paulo Coelho',
                price: 450,
                category: 'Fiction',
                img: '/uploads/1790270705283-s.jpg'
            },
            {
                title: 'Atomic Habits',
                author: 'James Clear',
                price: 520,
                category: 'Self Growth',
                img: '/uploads/HP.jpg'
            },
            {
                title: 'Clean Code',
                author: 'Robert C. Martin',
                price: 680,
                category: 'Technology',
                img: '/clean-code-cover.svg'
            }
        ]);
    }

    await Book.updateMany(
        { $or: [{ img: { $exists: false } }, { img: null }, { img: '' }] },
        { $set: { img: '/default-book-cover.svg' } }
    );
}

async function main() {
    await mongooes.connect('mongodb://abhay:acIN7hl9ghpKrmK4@ac-dwwratw-shard-00-00.0ifeunc.mongodb.net:27017,ac-dwwratw-shard-00-01.0ifeunc.mongodb.net:27017,ac-dwwratw-shard-00-02.0ifeunc.mongodb.net:27017/?ssl=true&replicaSet=atlas-ne25zu-shard-0&authSource=admin&appName=Cluster0')
    await seedBooks();
    console.log("DB Connected")
}


main()
.catch((err)=>{console.log(err)})

const bookschema = mongooes.Schema({
    title:String,
    author: String,
    price: Number,
    category: String,
    img: String
})

const Book = mongooes.model("Book",bookschema)

app.set('view engine','ejs')
app.use(express.static(publicDir))
app.use(express.urlencoded({ extended: true }));

fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }

});

const upload = multer({ storage: storage });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

app.use(session({
    secret: 'bookstoresecret',
    resave: false,
    saveUninitialized: false
}));

function isAdmin(req, res, next) {
    if (req.session.isAdmin) {
        next();
    } else {
        res.send('Access Denied');
    }
}

app.get('/',(req,res)=>{
    res.render('home')
})

app.get('/admin/login', (req, res) => {
    res.render('adminlogin');
});

app.post('/admin/login', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.redirect('/books');
    } else {
        res.send('Invalid Username or Password');
    }
});

app.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/about',(req,res)=>{
    res.render('about')
})

app.get('/books',async(req,res)=>{
    const books = (await Book.find().sort({ _id: -1 })).map(normalizeBookImage);
    res.render('books',{books, isAdmin: !!req.session.isAdmin})
})

app.get('/books/new',isAdmin,(req,res)=>{
    res.render('newbook')
})

app.post('/books',isAdmin, upload.single('img'), async (req, res) => {
    const book = new Book({
        title: req.body.title,
        author: req.body.author,
        price: req.body.price,
        category: req.body.category,
        img: req.file ? '/uploads/' + req.file.filename : '/default-book-cover.svg'
    });
    await book.save();
    res.redirect('/books');
});

app.get('/books/edit/:id',isAdmin, async (req, res) => {
    const id = req.params.id;
    const book = await Book.findById(id);
    res.render('editbook', { book });
});

app.post('/books/edit/:id',isAdmin, upload.single('img'), async (req, res) => {
    const id = req.params.id;
    const book = await Book.findById(id);
    book.title = req.body.title;
    book.author = req.body.author;
    book.price = req.body.price;
    book.category = req.body.category;
    if (req.file) {
        book.img = '/uploads/' + req.file.filename;
    } else if (!book.img) {
        book.img = '/default-book-cover.svg';
    }
    await book.save();
    res.redirect('/books');
});


app.post('/books/delete/:id',isAdmin, async (req, res) => {
    const id = req.params.id;
    await Book.findByIdAndDelete(id);
    res.redirect('/books');
});

app.get('/category', async (req, res) => {
    const books = (await Book.find()).map(normalizeBookImage);
    const categories = [...new Set(books.map(book => book.category).filter(Boolean))].sort();
    const categoryCounts = books.reduce((counts, book) => {
        if (book.category) {
            counts[book.category] = (counts[book.category] || 0) + 1;
        }
        return counts;
    }, {});
    res.render('categories', {
        books,
        categories,
        categoryCounts,
        currentCategory: null,
        totalBookCount: books.length
    });
});

app.get('/category/:category', async (req, res) => {
    const category = req.params.category;
    const allBooks = (await Book.find()).map(normalizeBookImage);
    const books = allBooks.filter(book => book.category === category);
    const categories = [...new Set(allBooks.map(book => book.category).filter(Boolean))].sort();
    const categoryCounts = allBooks.reduce((counts, book) => {
        if (book.category) {
            counts[book.category] = (counts[book.category] || 0) + 1;
        }
        return counts;
    }, {});
    res.render('categories', {
        books,
        categories,
        categoryCounts,
        currentCategory: category,
        totalBookCount: allBooks.length
    });
});

app.get('/contact',(req,res)=>{
    res.render('contact')
})

app.post('/contact', async (req, res) => {
    const name = req.body.name;
    const email = req.body.email;
    const phone = req.body.phone;
    const message = req.body.message;

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.error('Contact email is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env.');
        return res.status(503).send('Email is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to .env, then restart the server.');
    }

    try {
        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: 'abhaymahawar440@gmail.com',
            replyTo: email,
            subject: 'New Customer Message',
            text: `Name: ${name} Email: ${email} Phone: ${phone} Message: ${message}`
        });
        res.send(`<script>
                alert("Message Sent Successfully!");
                window.location.href = "/contact";
            </script>`);
    } catch (error) {
        console.error('Contact email delivery failed:', error);
        res.status(502).send('Email could not be delivered. Check the server logs for the mail error and verify your Gmail App Password.');
    }
});

app.listen(port,()=>{
    console.log("Listening on "+port)
})