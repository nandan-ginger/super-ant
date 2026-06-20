const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate a cryptographically secure 64-byte random string (128 characters in hex)
const secret = crypto.randomBytes(64).toString('hex');

console.log('==================================================');
console.log('         JWT Secret Code Generator                ');
console.log('==================================================');
console.log('\nGenerated Secure JWT Secret:');
console.log('\x1b[32m%s\x1b[0m', secret);
console.log('==================================================\n');

const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  try {
    let envContent = fs.readFileSync(envPath, 'utf8');
    const jwtSecretRegex = /^JWT_SECRET=.*$/m;
    
    if (jwtSecretRegex.test(envContent)) {
      envContent = envContent.replace(jwtSecretRegex, `JWT_SECRET=${secret}`);
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('\x1b[36m%s\x1b[0m', 'Successfully updated JWT_SECRET in your local .env file.');
    } else {
      // If the variable doesn't exist, append it
      envContent += `\nJWT_SECRET=${secret}\n`;
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('\x1b[36m%s\x1b[0m', 'Successfully appended JWT_SECRET to your local .env file.');
    }
  } catch (error) {
    console.error('Error updating .env file:', error.message);
    console.log('Please copy the secret above and manually paste it into your .env file as:');
    console.log(`JWT_SECRET=${secret}`);
  }
} else {
  console.log('No local .env file found in this directory.');
  console.log('Please copy .env.example to .env and configure the JWT_SECRET:');
  console.log(`JWT_SECRET=${secret}`);
}
