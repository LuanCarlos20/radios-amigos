const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// Servir a pasta public
app.use(express.static(path.join(__dirname, "public")));

// Usuários conectados
const usuarios = new Map();

// Salas
const salas = new Map();

io.on("connection", (socket) => {

    console.log("Usuário conectado:", socket.id);

    // ==========================================
    // ENTRAR NO SISTEMA
    // ==========================================

    socket.on("entrar", (nome) => {

        if (!nome) {
            return;
        }

        usuarios.set(socket.id, {
            id: socket.id,
            nome: nome
        });

        console.log(`${nome} entrou no sistema.`);

        atualizarUsuarios();
    });


    // ==========================================
    // ENTRAR EM UMA SALA
    // ==========================================

    socket.on("entrar-sala", (dados) => {

        const sala = dados.sala;
        const nome = dados.nome;

        if (!sala || !nome) {
            return;
        }

        // Se o usuário já estava em outra sala
        if (socket.salaAtual) {

            const salaAnterior = socket.salaAtual;

            socket.leave(salaAnterior);

            removerDaSala(
                salaAnterior,
                socket.id
            );

            socket.to(salaAnterior).emit(
                "usuario-saiu",
                socket.id
            );

            atualizarSala(salaAnterior);
        }


        // Criar a sala caso não exista
        if (!salas.has(sala)) {

            salas.set(
                sala,
                new Map()
            );
        }


        const usuariosSala = salas.get(sala);


        // Guardar quem já estava na sala
        const usuariosExistentes =
            Array.from(
                usuariosSala.values()
            );


        // Entrar na sala
        socket.join(sala);

        socket.salaAtual = sala;


        // Adicionar o usuário
        usuariosSala.set(
            socket.id,
            {
                id: socket.id,
                nome: nome
            }
        );


        console.log(
            `${nome} entrou na sala "${sala}".`
        );


        // ==========================================
        // AVISAR QUEM JÁ ESTAVA NA SALA
        // ==========================================

        socket.to(sala).emit(
            "usuario-entrou-sala",
            {
                id: socket.id,
                nome: nome
            }
        );


        // ==========================================
        // AVISAR O NOVO USUÁRIO SOBRE QUEM JÁ ESTAVA
        // ==========================================

        socket.emit(
            "usuarios-da-sala",
            usuariosExistentes
        );


        // Confirmar sala
        socket.emit(
            "sala-confirmada",
            {
                sala: sala,
                quantidade: usuariosSala.size
            }
        );


        // Atualizar quantidade
        atualizarSala(sala);
    });


    // ==========================================
    // WEBRTC — OFERTA
    // ==========================================

    socket.on("webrtc-offer", (dados) => {

        if (!dados || !dados.para || !dados.oferta) {
            return;
        }

        io.to(dados.para).emit(
            "webrtc-offer",
            {
                de: socket.id,
                oferta: dados.oferta
            }
        );
    });


    // ==========================================
    // WEBRTC — RESPOSTA
    // ==========================================

    socket.on("webrtc-answer", (dados) => {

        if (!dados || !dados.para || !dados.resposta) {
            return;
        }

        io.to(dados.para).emit(
            "webrtc-answer",
            {
                de: socket.id,
                resposta: dados.resposta
            }
        );
    });


    // ==========================================
    // WEBRTC — ICE CANDIDATE
    // ==========================================

    socket.on("webrtc-ice", (dados) => {

        if (!dados || !dados.para || !dados.candidato) {
            return;
        }

        io.to(dados.para).emit(
            "webrtc-ice",
            {
                de: socket.id,
                candidato: dados.candidato
            }
        );
    });


    // ==========================================
    // DESCONECTAR
    // ==========================================

    socket.on("disconnect", () => {

        const usuario = usuarios.get(socket.id);

        if (usuario) {

            console.log(
                `${usuario.nome} saiu do sistema.`
            );
        }


        // Remover da sala
        if (socket.salaAtual) {

            const sala = socket.salaAtual;

            removerDaSala(
                sala,
                socket.id
            );


            // Avisar os outros usuários
            socket.to(sala).emit(
                "usuario-saiu",
                socket.id
            );


            atualizarSala(sala);
        }


        // Remover usuário
        usuarios.delete(socket.id);

        atualizarUsuarios();
    });

});


// ==========================================
// ATUALIZAR USUÁRIOS ONLINE
// ==========================================

function atualizarUsuarios() {

    io.emit(
        "usuarios-online",
        Array.from(
            usuarios.values()
        )
    );
}


// ==========================================
// REMOVER USUÁRIO DA SALA
// ==========================================

function removerDaSala(
    sala,
    socketId
) {

    if (!salas.has(sala)) {
        return;
    }

    const usuariosSala =
        salas.get(sala);

    usuariosSala.delete(socketId);


    // Se ficou vazia, apagar a sala
    if (usuariosSala.size === 0) {

        salas.delete(sala);
    }
}


// ==========================================
// ATUALIZAR QUANTIDADE DA SALA
// ==========================================

function atualizarSala(sala) {

    if (!salas.has(sala)) {
        return;
    }

    const quantidade =
        salas.get(sala).size;


    io.to(sala).emit(
        "usuarios-na-sala",
        quantidade
    );
}


// ==========================================
// INICIAR SERVIDOR
// ==========================================

server.listen(
    PORT,
    () => {

        console.log("");
        console.log(
            "================================="
        );

        console.log(
            "🎙️ RÁDIO AMIGOS"
        );

        console.log(
            "================================="
        );

        console.log(
            `Servidor: http://localhost:${PORT}`
        );

        console.log(
            "Servidor iniciado com sucesso!"
        );

        console.log("");
    }
);