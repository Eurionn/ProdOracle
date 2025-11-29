const signUpButton = document.getElementById('signUp');
const signInButton = document.getElementById('signIn');
const container = document.getElementById('container');

// Animação do Painel Deslizante
signUpButton.addEventListener('click', () => {
    container.classList.add("right-panel-active");
});

signInButton.addEventListener('click', () => {
    container.classList.remove("right-panel-active");
});

// Lógica de CADASTRO
document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-pass').value;

    // Regex simples para validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        Swal.fire('Erro!', 'Por favor, insira um email válido.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();

        if (res.ok) {
            Swal.fire({
                title: 'Sucesso!',
                text: 'Conta criada. Faça login para continuar.',
                icon: 'success',
                confirmButtonColor: '#0d6efd'
            }).then(() => {
                // Desliza para o painel de login
                container.classList.remove("right-panel-active");
            });
        } else {
            Swal.fire('Erro!', data.error, 'error');
        }
    } catch (error) {
        Swal.fire('Erro!', 'Falha ao conectar ao servidor.', 'error');
    }
});

// Lógica de LOGIN
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-pass').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok) {
            // Salva o "token" (simulado) e o nome do usuário
            localStorage.setItem('user_token', 'logged_in');
            localStorage.setItem('user_name', data.user.name);

            Swal.fire({
                title: `Bem-vindo, ${data.user.name}!`,
                text: 'Redirecionando para o dashboard...',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                window.location.href = 'index.html';
            });
        } else {
            Swal.fire('Acesso Negado', data.error, 'error');
        }
    } catch (error) {
        Swal.fire('Erro!', 'Falha ao conectar ao servidor.', 'error');
    }
});