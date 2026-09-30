const socket = io();

let meuNome = "";
let salaAtual = "";

let localStream = null;
let microfoneLigado = false;

const peers = {};
const candidatosPendentes = {};

const configuracaoWebRTC = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        },
        {
            urls: "stun:stun1.l.google.com:19302"
        }
    ]
};


// ==========================================
// ELEMENTOS DA PÁGINA
// ==========================================

const login = document.getElementById("login");
const sistema = document.getElementById("sistema");

const nomeInput = document.getElementById("nome");
const entrarBtn = document.getElementById("entrar");

const usuarioLogado = document.getElementById("usuario-logado");
const usuariosLista = document.getElementById("usuarios");

const nomeSalaInput = document.getElementById("nome-sala");
const criarSalaBtn = document.getElementById("criar-sala");

const salaAtualElemento = document.getElementById("sala-atual");

const falarBtn = document.getElementById("falar");
const mutarBtn = document.getElementById("mutar");

const microfoneStatus =
    document.getElementById("microfone-status");


// ==========================================
// ENTRAR
// ==========================================

entrarBtn.addEventListener("click", entrar);

nomeInput.addEventListener("keydown", (event) => {

    if (event.key === "Enter") {
        entrar();
    }

});


function entrar() {

    const nome = nomeInput.value.trim();

    if (!nome) {

        alert("Digite seu nome.");

        nomeInput.focus();

        return;
    }

    meuNome = nome;

    socket.emit(
        "entrar",
        meuNome
    );

    usuarioLogado.textContent =
        `Logado como: ${meuNome}`;

    login.classList.add("oculto");

    sistema.classList.remove("oculto");
}


// ==========================================
// USUÁRIOS ONLINE
// ==========================================

socket.on(
    "usuarios-online",
    (usuarios) => {

        usuariosLista.innerHTML = "";

        if (usuarios.length === 0) {

            const item =
                document.createElement("li");

            item.textContent =
                "Nenhum usuário online";

            usuariosLista.appendChild(item);

            return;
        }


        usuarios.forEach(
            (usuario) => {

                const item =
                    document.createElement("li");


                if (usuario.id === socket.id) {

                    item.textContent =
                        `🟢 ${usuario.nome} (você)`;

                } else {

                    item.textContent =
                        `🟢 ${usuario.nome}`;
                }


                usuariosLista.appendChild(item);
            }
        );
    }
);


// ==========================================
// CRIAR / ENTRAR NA SALA
// ==========================================

criarSalaBtn.addEventListener(
    "click",
    entrarNaSala
);


nomeSalaInput.addEventListener(
    "keydown",
    (event) => {

        if (event.key === "Enter") {

            entrarNaSala();
        }
    }
);


function entrarNaSala() {

    const nomeSala =
        nomeSalaInput.value.trim();


    if (!nomeSala) {

        alert("Digite o nome da sala.");

        nomeSalaInput.focus();

        return;
    }


    if (!meuNome) {

        alert("Entre no sistema primeiro.");

        return;
    }


    salaAtual = nomeSala;


    socket.emit(
        "entrar-sala",
        {
            sala: salaAtual,
            nome: meuNome
        }
    );


    salaAtualElemento.textContent =
        `🏠 Entrando na sala: ${salaAtual}`;


    nomeSalaInput.value = "";
}


// ==========================================
// SALA CONFIRMADA
// ==========================================

socket.on(
    "sala-confirmada",
    (dados) => {

        salaAtual =
            dados.sala;


        atualizarTextoSala(
            dados.quantidade
        );
    }
);


socket.on(
    "usuarios-na-sala",
    (quantidade) => {

        if (!salaAtual) {
            return;
        }

        atualizarTextoSala(
            quantidade
        );
    }
);


function atualizarTextoSala(
    quantidade
) {

    salaAtualElemento.textContent =
        `🏠 Sala atual: ${salaAtual} | 👥 ${quantidade} pessoa(s)`;
}


// ==========================================
// MICROFONE
// ==========================================

falarBtn.addEventListener(
    "click",
    async () => {

        if (!microfoneLigado) {

            await ligarMicrofone();

        } else {

            desligarMicrofone();
        }
    }
);


// ==========================================
// LIGAR MICROFONE
// ==========================================

async function ligarMicrofone() {

    try {

        if (!salaAtual) {

            alert(
                "Entre em uma sala primeiro."
            );

            return;
        }


        if (!localStream) {

            localStream =
                await navigator.mediaDevices.getUserMedia(
                    {
                        audio: true,
                        video: false
                    }
                );
        }


        localStream
            .getAudioTracks()
            .forEach(
                (track) => {
                    track.enabled = true;
                }
            );


        microfoneLigado = true;


        atualizarBotaoMicrofone();


        // Conectar com os usuários
        // que já estão na sala
        socket.emit(
            "pronto-para-falar"
        );


        const usuariosConectados =
            Object.keys(peers);


        for (
            const usuarioId
            of usuariosConectados
        ) {

            await criarOferta(
                usuarioId
            );
        }


        microfoneStatus.textContent =
            "🎙️ Microfone ligado — você está falando";

    } catch (erro) {

        console.error(
            "Erro ao acessar microfone:",
            erro
        );


        microfoneStatus.textContent =
            "❌ Não foi possível acessar o microfone.";


        alert(
            "Não foi possível acessar o microfone. Verifique a permissão do navegador."
        );
    }
}


// ==========================================
// DESLIGAR MICROFONE
// ==========================================

function desligarMicrofone() {

    if (!localStream) {
        return;
    }


    localStream
        .getAudioTracks()
        .forEach(
            (track) => {

                track.enabled = false;
            }
        );


    microfoneLigado = false;


    atualizarBotaoMicrofone();


    microfoneStatus.textContent =
        "🔇 Microfone desligado";
}


// ==========================================
// MUTAR
// ==========================================

mutarBtn.addEventListener(
    "click",
    () => {

        if (!localStream) {

            alert(
                "Ligue o microfone primeiro."
            );

            return;
        }


        const audioTracks =
            localStream.getAudioTracks();


        if (audioTracks.length === 0) {
            return;
        }


        const track =
            audioTracks[0];


        track.enabled =
            !track.enabled;


        microfoneLigado =
            track.enabled;


        atualizarBotaoMicrofone();


        if (track.enabled) {

            microfoneStatus.textContent =
                "🎙️ Microfone ligado";

        } else {

            microfoneStatus.textContent =
                "🔇 Microfone mutado";
        }
    }
);


// ==========================================
// ATUALIZAR BOTÕES
// ==========================================

function atualizarBotaoMicrofone() {

    if (microfoneLigado) {

        falarBtn.textContent =
            "🛑 Parar de falar";

        falarBtn.style.background =
            "#d64545";

        mutarBtn.textContent =
            "🔇 Mutar";

    } else {

        falarBtn.textContent =
            "🎙️ Falar";

        falarBtn.style.background =
            "#21a366";

        mutarBtn.textContent =
            "🔊 Desmutar";
    }
}


// ==========================================
// USUÁRIO ENTROU NA SALA
// ==========================================

socket.on(
    "usuario-entrou-sala",
    async (usuario) => {

        console.log(
            "Usuário entrou:",
            usuario.nome
        );


        // Apenas preparamos a conexão.
        // Quem acabou de entrar na sala
        // será responsável pela oferta.
        criarPeerConnection(
            usuario.id
        );
    }
);


// ==========================================
// USUÁRIOS QUE JÁ ESTAVAM NA SALA
// ==========================================

socket.on(
    "usuarios-da-sala",
    async (usuarios) => {

        for (
            const usuario
            of usuarios
        ) {

            criarPeerConnection(
                usuario.id
            );
        }


        // Se já estiver com microfone ligado,
        // iniciar as ofertas.
        if (microfoneLigado) {

            for (
                const usuario
                of usuarios
            ) {

                await criarOferta(
                    usuario.id
                );
            }
        }
    }
);


// ==========================================
// CRIAR CONEXÃO WEBRTC
// ==========================================

function criarPeerConnection(
    usuarioId
) {

    if (peers[usuarioId]) {

        return peers[usuarioId];
    }


    const peer =
        new RTCPeerConnection(
            configuracaoWebRTC
        );


    peers[usuarioId] =
        peer;


    candidatosPendentes[usuarioId] =
        [];


    // ======================================
    // ENVIAR ÁUDIO LOCAL
    // ======================================

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                (track) => {

                    peer.addTrack(
                        track,
                        localStream
                    );
                }
            );
    }


    // ======================================
    // RECEBER ÁUDIO DO AMIGO
    // ======================================

    peer.ontrack =
        (event) => {

            console.log(
                "Áudio recebido de:",
                usuarioId
            );


            let audio =
                document.getElementById(
                    `audio-${usuarioId}`
                );


            if (!audio) {

                audio =
                    document.createElement(
                        "audio"
                    );

                audio.id =
                    `audio-${usuarioId}`;

                audio.autoplay =
                    true;

                audio.playsInline =
                    true;

                audio.controls =
                    false;

                audio.style.display =
                    "none";

                document.body.appendChild(
                    audio
                );
            }


            if (
                event.streams &&
                event.streams[0]
            ) {

                audio.srcObject =
                    event.streams[0];

            } else {

                const stream =
                    new MediaStream(
                        [event.track]
                    );

                audio.srcObject =
                    stream;
            }


            audio.play().catch(
                (erro) => {

                    console.log(
                        "O navegador bloqueou o áudio automático.",
                        erro
                    );
                }
            );
        };


    // ======================================
    // ICE CANDIDATE
    // ======================================

    peer.onicecandidate =
        (event) => {

            if (
                event.candidate
            ) {

                socket.emit(
                    "webrtc-ice",
                    {
                        para: usuarioId,
                        candidato:
                            event.candidate
                    }
                );
            }
        };


    // ======================================
    // CONEXÃO
    // ======================================

    peer.onconnectionstatechange =
        () => {

            console.log(
                `Conexão ${usuarioId}:`,
                peer.connectionState
            );


            if (
                peer.connectionState ===
                "failed"
            ) {

                console.log(
                    "Conexão falhou:",
                    usuarioId
                );
            }
        };


    return peer;
}


// ==========================================
// CRIAR OFERTA
// ==========================================

async function criarOferta(
    usuarioId
) {

    try {

        if (!localStream) {

            console.log(
                "Microfone ainda não está ligado."
            );

            return;
        }


        const peer =
            criarPeerConnection(
                usuarioId
            );


        // Verificar se já existem
        // tracks adicionadas
        if (
            peer.getSenders().length === 0
        ) {

            localStream
                .getTracks()
                .forEach(
                    (track) => {

                        peer.addTrack(
                            track,
                            localStream
                        );
                    }
                );
        }


        const oferta =
            await peer.createOffer();


        await peer.setLocalDescription(
            oferta
        );


        socket.emit(
            "webrtc-offer",
            {
                para: usuarioId,
                oferta: oferta
            }
        );

    } catch (erro) {

        console.error(
            "Erro criando oferta:",
            erro
        );
    }
}


// ==========================================
// RECEBER OFERTA
// ==========================================

socket.on(
    "webrtc-offer",
    async (dados) => {

        try {

            const usuarioId =
                dados.de;


            const peer =
                criarPeerConnection(
                    usuarioId
                );


            // Se ainda não temos nosso áudio,
            // podemos apenas responder.
            if (
                localStream &&
                peer.getSenders().length === 0
            ) {

                localStream
                    .getTracks()
                    .forEach(
                        (track) => {

                            peer.addTrack(
                                track,
                                localStream
                            );
                        }
                    );
            }


            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    dados.oferta
                )
            );


            // Adicionar ICE que chegou antes
            await adicionarCandidatosPendentes(
                usuarioId
            );


            const resposta =
                await peer.createAnswer();


            await peer.setLocalDescription(
                resposta
            );


            socket.emit(
                "webrtc-answer",
                {
                    para: usuarioId,
                    resposta: resposta
                }
            );

        } catch (erro) {

            console.error(
                "Erro recebendo oferta:",
                erro
            );
        }
    }
);


// ==========================================
// RECEBER RESPOSTA
// ==========================================

socket.on(
    "webrtc-answer",
    async (dados) => {

        try {

            const peer =
                peers[dados.de];


            if (!peer) {
                return;
            }


            await peer.setRemoteDescription(
                new RTCSessionDescription(
                    dados.resposta
                )
            );


            await adicionarCandidatosPendentes(
                dados.de
            );

        } catch (erro) {

            console.error(
                "Erro recebendo resposta:",
                erro
            );
        }
    }
);


// ==========================================
// RECEBER ICE
// ==========================================

socket.on(
    "webrtc-ice",
    async (dados) => {

        try {

            const usuarioId =
                dados.de;


            const peer =
                criarPeerConnection(
                    usuarioId
                );


            if (
                peer.remoteDescription &&
                peer.remoteDescription.type
            ) {

                await peer.addIceCandidate(
                    new RTCIceCandidate(
                        dados.candidato
                    )
                );

            } else {

                candidatosPendentes[
                    usuarioId
                ].push(
                    dados.candidato
                );
            }

        } catch (erro) {

            console.error(
                "Erro adicionando ICE:",
                erro
            );
        }
    }
);


// ==========================================
// ADICIONAR ICE PENDENTE
// ==========================================

async function adicionarCandidatosPendentes(
    usuarioId
) {

    const peer =
        peers[usuarioId];


    if (!peer) {
        return;
    }


    const lista =
        candidatosPendentes[
            usuarioId
        ] || [];


    for (
        const candidato
        of lista
    ) {

        try {

            await peer.addIceCandidate(
                new RTCIceCandidate(
                    candidato
                )
            );

        } catch (erro) {

            console.error(
                "Erro adicionando ICE pendente:",
                erro
            );
        }
    }


    candidatosPendentes[
        usuarioId
    ] = [];
}


// ==========================================
// USUÁRIO SAIU
// ==========================================

socket.on(
    "usuario-saiu",
    (usuarioId) => {

        console.log(
            "Usuário saiu:",
            usuarioId
        );


        if (peers[usuarioId]) {

            peers[usuarioId].close();

            delete peers[usuarioId];
        }


        delete candidatosPendentes[
            usuarioId
        ];


        const audio =
            document.getElementById(
                `audio-${usuarioId}`
            );


        if (audio) {

            audio.srcObject =
                null;

            audio.remove();
        }
    }
);