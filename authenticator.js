const base32 = new (require('./fixedBitNotation'))(5, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', true, true)
const crypto = require('crypto')
const codePeriod = 30 // 30s
const passCodeLength = 6 // 6 digits
const secretLength = 10 // 10 bytes secret
const pinModulo = 10 ** passCodeLength

/**
 * Generates a URL that is used to show a QR code.
 *
 * Account names may not contain a double colon (:). Valid account name
 * examples:
 *   "John.Doe@gmail.com"
 *   "John Doe"
 *   "John_Doe_976"
 *
 * The Issuer may not contain a double colon (:). The issuer is recommended
 * to pass along. If used, it will also be appended before the accountName.
 *
 * The previous examples with the issuer "Acme inc" would result in label:
 *   "Acme inc:John.Doe@gmail.com"
 *   "Acme inc:John Doe"
 *   "Acme inc:John_Doe_976"
 *
 * The contents of the label, issuer and secret will be encoded to generate
 * a valid URL.
 *
 * @param {String}  accountName The account name to show and identify
 * @param {String}  secret  The secret is the generated secret unique to that user
 * @param {String|null} issuer  Where you log in to
 * @param {Number}  size Image size in pixels, 200 will make it 200x200
 *
 * @return {String}
 */
function getQrcode (accountName, secret, issuer = null, size = 200) {
  if (accountName === '' || ~accountName.indexOf(':')) {
    throw new Error('InvalidAccountName: ' + accountName)
  }
  if (secret === '') {
    throw new Error('InvalidSecret')
  }
  let label = accountName
  let otpauthString = '?secret=' + encodeURIComponent(secret)

  if (issuer !== null) {
    if (issuer === '' || ~issuer.indexOf(':')) {
      throw new Error('InvalidIssuer' + issuer)
    }
    // use both the issuer parameter and label prefix as recommended by Google for BC reasons
    label = issuer + ':' + label
    otpauthString += '&issuer=' + encodeURIComponent(issuer)
  }
  otpauthString = 'otpauth://totp/' + encodeURIComponent(label) + otpauthString
  return `https://chart.googleapis.com/chart?chs=${size}x${size}&chld=M|0&cht=qr&chl=${encodeURIComponent(otpauthString)}`
}

function verifyCode (secret, code) {
  code = Buffer.from(code)
  if (code.length !== passCodeLength) {
    return false
  }
  secret = base32.decode(secret)
  const time = Math.floor(Date.now() / 1000)
  if (code.equals(Buffer.from(getCode(secret, time)))) return true
  if (code.equals(Buffer.from(getCode(secret, time - codePeriod)))) return true
  if (code.equals(Buffer.from(getCode(secret, time + codePeriod)))) return true
  return false
}

function hmacSHA1 (s, key) {
  return crypto.createHmac('sha1', key).update(s).digest()
}

function getCode (secret, time) {
  const timeForCode = Buffer.allocUnsafe(8)
  timeForCode.fill(0)
  timeForCode.writeUInt32BE(Math.floor(time / codePeriod), 4)
  const hash = hmacSHA1(timeForCode, secret)
  const truncatedHash = hash.readUInt32BE(hash[hash.length - 1] & 0xF) & 0x7FFFFFFF
  const code = ((truncatedHash % pinModulo) + '').padStart(passCodeLength, '0')
  // console.log(code)
  return code
}

function generateSecret () {
  return base32.encode(crypto.randomBytes(secretLength))
}

exports = module.exports = {
  getQrcode,
  verifyCode,
  getCode,
  generateSecret
}
