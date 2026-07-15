/* ==========================================================
   DocAI — Authentication Page Logic
   Handles OTP flow, keyboard listeners, and AJAX auth queries
   ========================================================== */

let activeEmail = "";
let currentDevOtp = "";

document.addEventListener('DOMContentLoaded', () => {
    setupOtpNavigation();
});

// Switch view between email and OTP code step
function goToStep(step) {
    const stepEmail = document.getElementById('stepEmail');
    const stepOtp = document.getElementById('stepOtp');
    const alertBox = document.getElementById('authAlert');
    
    // Hide alerts on switch
    alertBox.style.display = 'none';

    if (step === 'email') {
        stepOtp.classList.remove('active');
        setTimeout(() => {
            stepOtp.style.display = 'none';
            stepEmail.style.display = 'flex';
            setTimeout(() => stepEmail.classList.add('active'), 20);
        }, 300);
    } else if (step === 'otp') {
        stepEmail.classList.remove('active');
        setTimeout(() => {
            stepEmail.style.display = 'none';
            stepOtp.style.display = 'flex';
            setTimeout(() => stepOtp.classList.add('active'), 20);
            
            // Focus on first box
            const firstBox = document.querySelector('.otp-box');
            if (firstBox) firstBox.focus();
        }, 300);
    }
}

// Show alerts/toasts inside the card
function showAuthAlert(msg, type = 'error') {
    const alertBox = document.getElementById('authAlert');
    alertBox.textContent = msg;
    alertBox.className = `auth-alert ${type}`;
    alertBox.style.display = 'block';
    
    // Retrigger shake animation on error
    if (type === 'error') {
        alertBox.style.animation = 'none';
        alertBox.offsetHeight; // trigger reflow
        alertBox.style.animation = 'alertShake 0.4s ease';
    }
}

// Request OTP code API call
async function handleSendOtp(event) {
    if (event) event.preventDefault();
    
    const emailInput = document.getElementById('userEmail');
    const email = emailInput.value.trim();
    if (!email) return;

    activeEmail = email;
    const btn = document.getElementById('btnSendOtp');
    btn.disabled = true;
    btn.querySelector('span').textContent = "Sending code…";
    
    const alertBox = document.getElementById('authAlert');
    alertBox.style.display = 'none';

    try {
        const response = await fetch('/api/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            document.getElementById('displayTargetEmail').textContent = email;
            
            // If in Dev mode (no SMTP), show dev helper
            const devNotice = document.getElementById('devModeNotice');
            if (data.dev_mode && data.otp) {
                currentDevOtp = data.otp;
                document.getElementById('devOtpCode').textContent = data.otp;
                devNotice.style.display = 'flex';
            } else {
                devNotice.style.display = 'none';
            }

            goToStep('otp');
            showAuthAlert("Verification code sent to your email.", "success");
        } else {
            showAuthAlert(data.error || "Failed to send code. Please try again.");
        }
    } catch (err) {
        showAuthAlert("Connection error. Ensure your server is running.");
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.querySelector('span').textContent = "Send verification code";
    }
}

// Resend OTP code
async function resendOtp() {
    const resendBtn = document.getElementById('btnResendOtp');
    resendBtn.disabled = true;
    resendBtn.textContent = "Sending…";
    
    // Clear OTP inputs
    const boxes = document.querySelectorAll('.otp-box');
    boxes.forEach(box => box.value = '');

    try {
        const response = await fetch('/api/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: activeEmail })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Update dev notice if code changed
            if (data.dev_mode && data.otp) {
                currentDevOtp = data.otp;
                document.getElementById('devOtpCode').textContent = data.otp;
                document.getElementById('devModeNotice').style.display = 'flex';
            }
            showAuthAlert("A new verification code has been sent.", "success");
            
            // Focus back on first box
            const firstBox = document.querySelector('.otp-box');
            if (firstBox) firstBox.focus();
        } else {
            showAuthAlert(data.error || "Failed to resend code.");
        }
    } catch (err) {
        showAuthAlert("Connection error. Could not resend.");
    } finally {
        resendBtn.disabled = false;
        resendBtn.textContent = "Resend code";
    }
}

// Verify OTP API Call
async function handleVerifyOtp(event) {
    if (event) event.preventDefault();
    
    const boxes = document.querySelectorAll('.otp-box');
    let otpCode = "";
    boxes.forEach(box => otpCode += box.value.trim());
    
    if (otpCode.length < 6) {
        showAuthAlert("Please enter all 6 digits of the code.");
        return;
    }

    const btn = document.getElementById('btnVerifyOtp');
    btn.disabled = true;
    btn.querySelector('span').textContent = "Verifying…";

    try {
        const response = await fetch('/api/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: activeEmail, otp: otpCode })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showAuthAlert("Authenticated successfully! Redirecting…", "success");
            setTimeout(() => {
                window.location.href = "/";
            }, 1000);
        } else {
            showAuthAlert(data.error || "Incorrect or expired code. Please try again.");
            // Reset OTP inputs on failure
            boxes.forEach((box, i) => {
                box.value = '';
                if (i === 0) box.focus();
            });
        }
    } catch (err) {
        showAuthAlert("Connection error. Could not verify.");
        console.error(err);
        btn.disabled = false;
        btn.querySelector('span').textContent = "Verify and sign in";
    }
}

// Premium OTP 6-Digit input navigational handling
function setupOtpNavigation() {
    const boxes = document.querySelectorAll('.otp-box');
    
    boxes.forEach((box, index) => {
        // 1. Move to next box on key input
        box.addEventListener('input', (e) => {
            const val = box.value;
            // Ensure only digits are typed
            if (!/^[0-9]$/.test(val)) {
                box.value = '';
                return;
            }
            
            if (val && index < boxes.length - 1) {
                boxes[index + 1].focus();
            }
            
            // Auto submit if last input is filled
            checkAndSubmitIfComplete();
        });
        
        // 2. Backspace handler to move focus backwards
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                if (!box.value && index > 0) {
                    boxes[index - 1].value = '';
                    boxes[index - 1].focus();
                } else {
                    box.value = '';
                }
            } else if (e.key === 'ArrowLeft' && index > 0) {
                boxes[index - 1].focus();
            } else if (e.key === 'ArrowRight' && index < boxes.length - 1) {
                boxes[index + 1].focus();
            }
        });
        
        // 3. Paste support (can paste 6-digit number)
        box.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
            if (/^\d{6}$/.test(pasteData)) {
                boxes.forEach((b, i) => {
                    b.value = pasteData[i];
                });
                boxes[boxes.length - 1].focus();
                checkAndSubmitIfComplete();
            }
        });
    });
}

function checkAndSubmitIfComplete() {
    const boxes = document.querySelectorAll('.otp-box');
    let isComplete = true;
    boxes.forEach(box => {
        if (!box.value) isComplete = false;
    });
    
    if (isComplete) {
        handleVerifyOtp();
    }
}

// Dev Mode Helpers
function copyDevOtp() {
    if (!currentDevOtp) return;
    navigator.clipboard.writeText(currentDevOtp).then(() => {
        const btn = document.querySelector('.dev-copy-btn');
        const origText = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => btn.textContent = origText, 1500);
    }).catch(err => {
        console.error("Failed to copy code: ", err);
    });
}
