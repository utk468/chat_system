const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');


const app = express();
const server = http.createServer(app);
const io = socketIo(server);


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); 


mongoose.connect('mongodb://127.0.0.1:27017/chatApp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});




const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);


const messageSchema = new mongoose.Schema({
  type: String, 
  content: String, 
  sender: String, 
  timestamp: { type: Date, default: Date.now },
  image: String, 
});
const Message = mongoose.model('Message', messageSchema);



// Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './public/uploads'); // Ensure images are saved in the correct directory
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // File names are timestamped
  },
});
const upload = multer({ storage });




app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});


app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashedPassword });
    
    res.status(201).send('Registration successful');
  
  } catch (err) {

    console.error(err);
    
    res.status(400).send('User already exists');
  
  }
});


app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {

    const user = await User.findOne({ username });
    if (!user) return res.status(400).send('User not found');
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send('Invalid password');
    
    res.status(200).json({ message: 'Login successful', username });
  
  } catch (err) {

    console.error(err);

    res.status(500).send('Login failed');
  
  }
});




app.post('/send', upload.single('image'), async (req, res) => {

  const { content, sender } = req.body;

  let newMessage;

  try {

    if (req.file && content) {

      newMessage = await Message.create({
        type: 'text_image',
        content,
        sender,
        image: `/uploads/${req.file.filename}`, 
      });

    } else if (req.file) {

      newMessage = await Message.create({
        type: 'image',
        content: '',
        sender,
        image: `/uploads/${req.file.filename}`,
      });

    } else if (content) {

      newMessage = await Message.create({
        type: 'text',
        content,
        sender,
      });

    } else {

      return res.status(400).send('No message content or image provided');
    
    }

    io.emit('new_message', newMessage); 
    res.status(200).send('Message sent');
  
  } catch (err) {

    console.error(err);

    res.status(500).send('Failed to send message');
  
  }
});


io.on('connection', (socket) => {

  console.log('User connected');

  
  Message.find()
    .then((messages) => {
      socket.emit('previous_messages', messages);
    })
    .catch((err) => console.error('Error loading messages:', err));


  
  socket.on('send_message', async ({ sender, content }) => {

    try {

      const newMessage = await Message.create({
        type: 'text',
        content,
        sender,
      });

      io.emit('new_message', newMessage);
    
    } catch (err) {

      console.error('Error sending message:', err);
    
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });

});



const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
