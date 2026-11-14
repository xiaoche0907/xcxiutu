document.getElementById('loginForm').addEventListener('submit', function (e) {
    const checkbox = document.getElementById('termsCheckbox');
    const termsText = document.querySelector('.terms-text');
    if (!checkbox.checked) {
        e.preventDefault();
        termsText.style.color = '#ff6b6b';
        termsText.style.animation = 'shake 0.5s';
        termsText.addEventListener('animationend', function() {
            termsText.style.animation = '';
        });
    } else {
        termsText.style.color = '#a8a8b3';
    }
});
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);
function togglePasswordVisibility() {
    var passwordInput = document.getElementById('password');
    var eyeIcon = document.querySelector('.password-toggle i');
    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = "password";
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}
function showAccountLogin() {
    document.getElementById('accountLogin').classList.add('active');
    document.getElementById('phoneLogin').classList.remove('active');
    document.getElementById('accountLoginBtn').classList.add('active');
    document.getElementById('phoneLoginBtn').classList.remove('active');
}
function showPhoneLogin() {
    document.getElementById('accountLogin').classList.remove('active');
    document.getElementById('phoneLogin').classList.add('active');
    document.getElementById('phoneLoginBtn').classList.add('active');
    document.getElementById('accountLoginBtn').classList.remove('active');
}
document.getElementById('getCodeBtn').addEventListener('click', function () {
    const phoneInput = document.getElementById('phone');
    const phoneNumber = phoneInput.value.trim();
    const phoneRegex = /^1[3-9]\d{9}$/;

    if (!phoneRegex.test(phoneNumber)) {
        const errorDisplay = document.getElementById('errorDisplay');
        errorDisplay.textContent = '请输入有效的十一位手机号';
        phoneInput.style.borderColor = '#ff6b6b';
    } else {
        const errorDisplay = document.getElementById('errorDisplay');
        errorDisplay.textContent = '请使用账号登录';
        phoneInput.style.borderColor = '';
    }
});
document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const errorDisplay = document.getElementById('errorDisplay');
    errorDisplay.textContent = '';
    const activeLogin = document.getElementById('accountLogin').classList.contains('active') ? 'accountLogin' : 'phoneLogin';
    let inputs = [];
    if (activeLogin === 'accountLogin') {
        inputs = [document.getElementById('username'), document.getElementById('password')];
    } else {
        inputs = [document.getElementById('phone'), document.getElementById('verificationCode')];
    }
    let isValid = true;
    inputs.forEach(input => {
        if (input.value.trim() === '') {
            input.style.borderColor = '#ff6b6b';
            isValid = false;
        } else {
            input.style.borderColor = '';
        }
    });
    if (isValid) {
        const formData = new FormData(this);
        const loginData = {};
        for (let [key, value] of formData.entries()) {
            loginData[key] = value;
        }
        fetch('http://iceai.cc/iceaiapp/lol.php', {
            method: 'POST',
            mode: 'cors', 
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams(loginData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                localStorage.setItem('lastLogin', new Date().getTime());
                localStorage.setItem('isLoggedIn', 'true');
                window.location.href = 'home.html';
            } else {
                errorDisplay.textContent = data.message;
                errorDisplay.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Error:', error);
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                errorDisplay.textContent = '网络连接失败，请检查网络连接';
            } else if (error.message.includes('HTTP error')) {
                errorDisplay.textContent = '服务器响应错误，请稍后重试';
            } else {
                errorDisplay.textContent = '登录失败：' + error.message;
            }
            errorDisplay.style.display = 'block';
        });
    } else {
        errorDisplay.textContent = '请填写所有必填字段';
        errorDisplay.style.display = 'block';
    }
});
