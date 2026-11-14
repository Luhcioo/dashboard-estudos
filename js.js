
const PRIORIDADES = { baixa: "Baixa", media: "Média", alta: "Alta" };
const STATUS = { pendente: "Pendente", andamento: "Em andamento", concluido: "Concluído" };
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DURACAO_POMODORO = 25 * 60; 
const MAX_ATIVIDADES = 10;


const IDS = [
  "totalMaterias", "totalConteudos", "totalConcluidos", "tempoEstudado", "barra", "textoProgresso",
  "semana", "estudosDia", "tempo", "btnIniciar", "btnPausar", "btnReiniciar", "atividades",
  "formMateria", "nomeMateria", "erroMateria", "listaMaterias",
  "formConteudo", "tituloConteudo", "materiaConteudo", "prioridadeConteudo", "dataConteudo",
  "erroConteudo", "filtroMateria", "filtroPrioridade", "filtroStatus", "filtroData", "listaConteudos"
];
const dom = {};
IDS.forEach((id) => { dom[id] = document.getElementById(id); });
const faltando = IDS.filter((id) => !dom[id]);
if (faltando.length) throw new Error(`Elementos não encontrados no HTML: ${faltando.join(", ")}`);

const telas = document.querySelectorAll(".tela");
const botoesNav = document.querySelectorAll("nav button[data-tela]");



function criar(tag, props = {}, ...filhos) {
  const no = document.createElement(tag);
  const { classe, texto, ...resto } = props;
  if (classe) no.className = classe;
  if (texto !== undefined) no.textContent = texto;
  for (const [chave, valor] of Object.entries(resto)) {
    if (chave.startsWith("on")) no.addEventListener(chave.slice(2), valor);
    else if (chave === "value") no.value = valor;
    else if (valor === true) no.setAttribute(chave, "");
    else if (valor !== false && valor != null) no.setAttribute(chave, valor);
  }
  no.append(...filhos.filter(Boolean));
  return no;
}

const normalizar = (texto) => texto.trim().replace(/\s+/g, " ");

function paraISO(data) {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

const formatarData = (iso) => iso.split("-").reverse().join("/");

const formatarHora = (data) =>
  data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const formatarRelogio = (seg) =>
  `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;

function formatarMinutos(seg) {
  const min = Math.floor(seg / 60);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
}

function dataValida(valor) {
  if (!valor) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia);
  return d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia && ano >= 1900 && ano <= 2100;
}

function marcarErro(campo, temErro) {
  campo.classList.toggle("campo--erro", temErro);
  if (temErro) campo.setAttribute("aria-invalid", "true");
  else campo.removeAttribute("aria-invalid");
}

function aplicarErros(erros, campos, paragrafo) {
  Object.entries(campos).forEach(([chave, campo]) => marcarErro(campo, erros.some((e) => e.campo === chave)));
  paragrafo.textContent = erros.map((e) => e.msg).join(" ");
  if (erros.length) campos[erros[0].campo].focus();
  return erros.length === 0;
}

function restaurarFoco(chave) {
  if (chave) document.querySelector(`[data-foco="${chave}"]`)?.focus();
}


const estado = {
  materias: [],            
  conteudos: [],           
  atividades: [],          
  diaSelecionado: paraISO(new Date()),
  expandidas: new Set(),   
  editando: null,          
  tempoEstudadoSeg: 0,
  proximoId: 1
};

const novoId = () => estado.proximoId++;
const buscarMateria = (id) => estado.materias.find((m) => m.id === id);
const buscarConteudo = (id) => estado.conteudos.find((c) => c.id === id);
const contarConteudos = (materiaId) => estado.conteudos.filter((c) => c.materiaId === materiaId).length;


function mostrarTela(id) {
  telas.forEach((tela) => { tela.hidden = tela.id !== id; });
  botoesNav.forEach((botao) => {
    const ativo = botao.dataset.tela === id;
    botao.classList.toggle("ativo", ativo);
    if (ativo) botao.setAttribute("aria-current", "page");
    else botao.removeAttribute("aria-current");
  });
}


function registrarAtividade(texto) {
  estado.atividades.unshift({ texto, quando: new Date() });
  estado.atividades = estado.atividades.slice(0, MAX_ATIVIDADES);
  renderAtividades();
}

function renderAtividades() {
  dom.atividades.replaceChildren();
  if (!estado.atividades.length) {
    dom.atividades.append(criar("li", { classe: "vazio", texto: "Nenhuma atividade registrada ainda." }));
    return;
  }
  estado.atividades.forEach((a) => {
    dom.atividades.append(criar("li", {},
      criar("div", { classe: "item__corpo" },
        criar("div", { classe: "item__titulo", texto: a.texto }),
        criar("div", { classe: "item__meta", texto: formatarHora(a.quando) }))));
  });
}


function validarNomeMateria(nome, idIgnorado = null) {
  if (!nome) return "Informe o nome da matéria.";
  if (nome.length > 60) return "O nome deve ter no máximo 60 caracteres.";
  const repetida = estado.materias.some((m) =>
    m.id !== idIgnorado && m.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"));
  return repetida ? "Já existe uma matéria com esse nome." : "";
}

dom.formMateria.addEventListener("submit", (evento) => {
  evento.preventDefault();
  const nome = normalizar(dom.nomeMateria.value);
  const msg = validarNomeMateria(nome);
  dom.erroMateria.textContent = msg;
  marcarErro(dom.nomeMateria, Boolean(msg));
  if (msg) { dom.nomeMateria.focus(); return; }

  estado.materias.push({ id: novoId(), nome });
  registrarAtividade(`Matéria "${nome}" cadastrada`);
  dom.formMateria.reset();
  renderTudo();
  dom.nomeMateria.focus();
});

dom.nomeMateria.addEventListener("input", () => {
  dom.erroMateria.textContent = "";
  marcarErro(dom.nomeMateria, false);
});

function listaVinculados(materiaId) {
  const vinculados = estado.conteudos.filter((c) => c.materiaId === materiaId);
  const lista = criar("ul");
  if (!vinculados.length) {
    lista.append(criar("li", { classe: "vazio", texto: "Nenhum conteúdo vinculado." }));
    return lista;
  }
  vinculados.forEach((c) => lista.append(
    criar("li", { classe: classeItemConteudo(c) }, corpoConteudo(c, false))));
  return lista;
}

function itemMateria(m) {
  const qtd = contarConteudos(m.id);
  const aberta = estado.expandidas.has(m.id);
  const corpo = criar("div", { classe: "item__corpo" },
    criar("div", { classe: "item__titulo", texto: m.nome }),
    criar("div", { classe: "item__meta", texto: `${qtd} ${qtd === 1 ? "conteúdo" : "conteúdos"}` }));
  if (aberta) corpo.append(listaVinculados(m.id));

  const acoes = criar("div", { classe: "item__acoes" },
    criar("button", {
      type: "button", classe: "botao--secundario", "data-foco": `ver-${m.id}`,
      texto: aberta ? "Ocultar conteúdos" : "Ver conteúdos",
      "aria-expanded": String(aberta), "aria-label": `${aberta ? "Ocultar" : "Ver"} conteúdos de ${m.nome}`,
      onclick: () => alternarConteudos(m.id)
    }),
    criar("button", {
      type: "button", classe: "botao--secundario", texto: "Editar", "data-foco": `editar-m-${m.id}`,
      "aria-label": `Editar matéria ${m.nome}`, onclick: () => iniciarEdicao("materia", m.id)
    }),
    criar("button", {
      type: "button", classe: "botao--perigo", texto: "Excluir",
      "aria-label": `Excluir matéria ${m.nome}`, onclick: () => excluirMateria(m.id)
    }));
  return criar("li", {}, corpo, acoes);
}

function itemMateriaEdicao(m) {
  const campo = criar("input", { type: "text", value: m.nome, maxlength: "60", "aria-label": "Novo nome da matéria" });
  const erro = criar("p", { classe: "erro" });

  const cancelar = () => { estado.editando = null; renderTudo(`editar-m-${m.id}`); };
  const salvar = () => {
    const nome = normalizar(campo.value);
    const msg = validarNomeMateria(nome, m.id);
    erro.textContent = msg;
    marcarErro(campo, Boolean(msg));
    if (msg) { campo.focus(); return; }
    if (nome !== m.nome) {
      registrarAtividade(`Matéria "${m.nome}" renomeada para "${nome}"`);
      m.nome = nome;
    }
    estado.editando = null;
    renderTudo(`editar-m-${m.id}`);
  };

  campo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); salvar(); }
    if (e.key === "Escape") cancelar();
  });
  queueMicrotask(() => { campo.focus(); campo.select(); });

  return criar("li", {},
    criar("div", { classe: "item__corpo" }, campo, erro),
    criar("div", { classe: "item__acoes" },
      criar("button", { type: "button", texto: "Salvar", onclick: salvar }),
      criar("button", { type: "button", classe: "botao--secundario", texto: "Cancelar", onclick: cancelar })));
}

function alternarConteudos(id) {
  if (estado.expandidas.has(id)) estado.expandidas.delete(id);
  else estado.expandidas.add(id);
  renderTudo(`ver-${id}`);
}

function excluirMateria(id) {
  const m = buscarMateria(id);
  if (!m) return;
  const qtd = contarConteudos(id);
  const aviso = qtd ? ` Os ${qtd} conteúdo(s) vinculado(s) também serão excluídos.` : "";
  if (!window.confirm(`Excluir a matéria "${m.nome}"?${aviso}`)) return;

  estado.materias = estado.materias.filter((x) => x.id !== id);
  estado.conteudos = estado.conteudos.filter((c) => c.materiaId !== id);
  estado.expandidas.delete(id);
  registrarAtividade(`Matéria "${m.nome}" excluída${qtd ? ` com ${qtd} conteúdo(s)` : ""}`);
  renderTudo();
}

function renderMaterias() {
  dom.listaMaterias.replaceChildren();
  if (!estado.materias.length) {
    dom.listaMaterias.append(criar("li", { classe: "vazio", texto: "Nenhuma matéria cadastrada." }));
    return;
  }
  estado.materias.forEach((m) => {
    const editando = estado.editando?.tipo === "materia" && estado.editando.id === m.id;
    dom.listaMaterias.append(editando ? itemMateriaEdicao(m) : itemMateria(m));
  });
}


function preencherMaterias(select, valorSelecionado, textoPadrao) {
  select.replaceChildren(criar("option", { value: "", texto: textoPadrao }));
  estado.materias.forEach((m) => select.append(criar("option", { value: String(m.id), texto: m.nome })));
  select.value = valorSelecionado ? String(valorSelecionado) : "";
  if (select.selectedIndex === -1) select.selectedIndex = 0;
}

function renderSelects() {
  preencherMaterias(dom.materiaConteudo, dom.materiaConteudo.value, "Selecione uma matéria");
  preencherMaterias(dom.filtroMateria, dom.filtroMateria.value, "Todas as matérias");
}



function validarConteudo({ titulo, materiaId, data, dataIncompleta }) {
  const erros = [];
  if (!titulo) erros.push({ campo: "titulo", msg: "Informe o título do conteúdo." });
  else if (titulo.length > 100) erros.push({ campo: "titulo", msg: "O título deve ter no máximo 100 caracteres." });

  if (!estado.materias.length) erros.push({ campo: "materia", msg: "Cadastre uma matéria antes de adicionar conteúdos." });
  else if (!materiaId || !buscarMateria(materiaId)) erros.push({ campo: "materia", msg: "Selecione uma matéria." });

  if (dataIncompleta || !dataValida(data)) erros.push({ campo: "data", msg: "Informe uma data de estudo válida." });
  return erros;
}

dom.formConteudo.addEventListener("submit", (evento) => {
  evento.preventDefault();
  const dados = {
    titulo: normalizar(dom.tituloConteudo.value),
    materiaId: Number(dom.materiaConteudo.value) || null,
    data: dom.dataConteudo.value,
    dataIncompleta: dom.dataConteudo.validity.badInput
  };
  const campos = { titulo: dom.tituloConteudo, materia: dom.materiaConteudo, data: dom.dataConteudo };
  if (!aplicarErros(validarConteudo(dados), campos, dom.erroConteudo)) return;

  estado.conteudos.push({
    id: novoId(), titulo: dados.titulo, materiaId: dados.materiaId,
    prioridade: dom.prioridadeConteudo.value, status: "pendente", data: dados.data
  });
  registrarAtividade(`Conteúdo "${dados.titulo}" cadastrado`);
  dom.formConteudo.reset();
  renderTudo();
  dom.tituloConteudo.focus();
});

dom.formConteudo.addEventListener("input", () => {
  dom.erroConteudo.textContent = "";
  [dom.tituloConteudo, dom.materiaConteudo, dom.dataConteudo].forEach((c) => marcarErro(c, false));
});

const classeItemConteudo = (c) =>
  `item--${c.prioridade}${c.status === "concluido" ? " item--concluido" : ""}`;

function corpoConteudo(c, comMateria = true) {
  const meta = criar("div", { classe: "item__meta" });
  if (comMateria) meta.append(`${buscarMateria(c.materiaId)?.nome ?? "—"} · `);
  meta.append(
    criar("span", { classe: `badge badge--${c.prioridade}`, texto: `Prioridade ${PRIORIDADES[c.prioridade].toLowerCase()}` }),
    " ",
    criar("span", { classe: `badge badge--${c.status}`, texto: STATUS[c.status] }),
    ` · ${c.data ? `Estudo em ${formatarData(c.data)}` : "Sem data de estudo"}`);
  return criar("div", { classe: "item__corpo" }, criar("div", { classe: "item__titulo", texto: c.titulo }), meta);
}

function itemConteudo(c) {
  const selectStatus = criar("select", {
    "aria-label": `Status de ${c.titulo}`, "data-foco": `status-${c.id}`,
    onchange: (e) => alterarStatus(c, e.target.value)
  });
  Object.entries(STATUS).forEach(([valor, texto]) => selectStatus.append(criar("option", { value: valor, texto })));
  selectStatus.value = c.status;

  const acoes = criar("div", { classe: "item__acoes" },
    selectStatus,
    criar("button", {
      type: "button", texto: "Concluir", disabled: c.status === "concluido",
      "aria-label": `Concluir ${c.titulo}`, onclick: () => alterarStatus(c, "concluido")
    }),
    criar("button", {
      type: "button", classe: "botao--secundario", texto: "Editar", "data-foco": `editar-c-${c.id}`,
      "aria-label": `Editar ${c.titulo}`, onclick: () => iniciarEdicao("conteudo", c.id)
    }),
    criar("button", {
      type: "button", classe: "botao--perigo", texto: "Excluir",
      "aria-label": `Excluir ${c.titulo}`, onclick: () => excluirConteudo(c.id)
    }));
  return criar("li", { classe: classeItemConteudo(c) }, corpoConteudo(c), acoes);
}

function itemConteudoEdicao(c) {
  const titulo = criar("input", { type: "text", value: c.titulo, maxlength: "100", "aria-label": "Título do conteúdo" });
  const materia = criar("select", { "aria-label": "Matéria do conteúdo" });
  preencherMaterias(materia, c.materiaId, "Selecione uma matéria");
  const prioridade = criar("select", { "aria-label": "Prioridade do conteúdo" });
  Object.entries(PRIORIDADES).forEach(([valor, texto]) => prioridade.append(criar("option", { value: valor, texto })));
  prioridade.value = c.prioridade;
  const data = criar("input", { type: "date", value: c.data, "aria-label": "Data de estudo" });
  const erro = criar("p", { classe: "erro" });

  const cancelar = () => { estado.editando = null; renderTudo(`editar-c-${c.id}`); };
  const salvar = () => {
    const dados = {
      titulo: normalizar(titulo.value), materiaId: Number(materia.value) || null,
      data: data.value, dataIncompleta: data.validity.badInput
    };
    if (!aplicarErros(validarConteudo(dados), { titulo, materia, data }, erro)) return;

    Object.assign(c, { titulo: dados.titulo, materiaId: dados.materiaId, prioridade: prioridade.value, data: dados.data });
    registrarAtividade(`Conteúdo "${c.titulo}" editado`);
    estado.editando = null;
    renderTudo(`editar-c-${c.id}`);
  };

  titulo.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); salvar(); }
    if (e.key === "Escape") cancelar();
  });
  queueMicrotask(() => { titulo.focus(); titulo.select(); });

  return criar("li", { classe: classeItemConteudo(c) },
    criar("div", { classe: "item__corpo" }, titulo, materia, prioridade, data, erro),
    criar("div", { classe: "item__acoes" },
      criar("button", { type: "button", texto: "Salvar", onclick: salvar }),
      criar("button", { type: "button", classe: "botao--secundario", texto: "Cancelar", onclick: cancelar })));
}

function alterarStatus(c, status) {
  if (c.status === status || !STATUS[status]) return;
  c.status = status;
  registrarAtividade(status === "concluido"
    ? `Conteúdo "${c.titulo}" concluído`
    : `Status de "${c.titulo}" alterado para ${STATUS[status].toLowerCase()}`);
  renderTudo(`status-${c.id}`);
}

function excluirConteudo(id) {
  const c = buscarConteudo(id);
  if (!c || !window.confirm(`Excluir o conteúdo "${c.titulo}"?`)) return;
  estado.conteudos = estado.conteudos.filter((x) => x.id !== id);
  registrarAtividade(`Conteúdo "${c.titulo}" excluído`);
  renderTudo();
}

function iniciarEdicao(tipo, id) {
  estado.editando = { tipo, id };
  renderTudo();
}


function filtrarConteudos() {
  const materiaId = Number(dom.filtroMateria.value) || 0;
  const { value: prioridade } = dom.filtroPrioridade;
  const { value: status } = dom.filtroStatus;
  const { value: data } = dom.filtroData;
  return estado.conteudos.filter((c) =>
    (!materiaId || c.materiaId === materiaId) &&
    (!prioridade || c.prioridade === prioridade) &&
    (!status || c.status === status) &&
    (!data || c.data === data));
}

function renderConteudos() {
  dom.listaConteudos.replaceChildren();
  const visiveis = filtrarConteudos();
  if (!visiveis.length) {
    dom.listaConteudos.append(criar("li", {
      classe: "vazio",
      texto: estado.conteudos.length ? "Nenhum conteúdo encontrado com os filtros selecionados." : "Nenhum conteúdo cadastrado."
    }));
    return;
  }
  visiveis.forEach((c) => {
    const editando = estado.editando?.tipo === "conteudo" && estado.editando.id === c.id;
    dom.listaConteudos.append(editando ? itemConteudoEdicao(c) : itemConteudo(c));
  });
}

[dom.filtroMateria, dom.filtroPrioridade, dom.filtroStatus, dom.filtroData].forEach((filtro) => {
  filtro.addEventListener("input", renderConteudos);
  filtro.addEventListener("change", renderConteudos);
});


function renderTempoEstudado() {
  dom.tempoEstudado.textContent = formatarMinutos(estado.tempoEstudadoSeg);
}

function renderDashboard() {
  const total = estado.conteudos.length;
  const concluidos = estado.conteudos.filter((c) => c.status === "concluido").length;
  const porcentagem = total ? Math.round((concluidos / total) * 100) : 0;

  dom.totalMaterias.textContent = estado.materias.length;
  dom.totalConteudos.textContent = total;
  dom.totalConcluidos.textContent = concluidos;
  dom.barra.style.width = `${porcentagem}%`;
  dom.textoProgresso.textContent = `${porcentagem}% concluído`;
  renderTempoEstudado();
}

function renderSemana() {
  const hoje = new Date();
  const hojeISO = paraISO(hoje);
  const diasComEstudo = new Set(estado.conteudos.filter((c) => c.data).map((c) => c.data));
  dom.semana.replaceChildren();

  for (let i = 0; i < 7; i++) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - hoje.getDay() + i);
    const iso = paraISO(data);
    const ativo = iso === estado.diaSelecionado;
    const temEstudo = diasComEstudo.has(iso);
    const classes = ["dia"];
    if (iso === hojeISO) classes.push("dia--hoje");
    if (ativo) classes.push("dia--ativo");
    if (temEstudo) classes.push("dia--com-estudo");

    const descricao = data.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
    dom.semana.append(criar("button", {
      type: "button", classe: classes.join(" "), "data-foco": `dia-${iso}`,
      "aria-pressed": String(ativo),
      "aria-label": `${descricao}${temEstudo ? ", com estudo programado" : ""}`,
      onclick: () => selecionarDia(iso)
    },
    criar("span", { classe: "dia__nome", texto: DIAS_SEMANA[i] }),
    criar("span", { classe: "dia__num", texto: String(data.getDate()) })));
  }
}

function selecionarDia(iso) {
  estado.diaSelecionado = iso;
  renderSemana();
  renderEstudosDia();
  restaurarFoco(`dia-${iso}`);
}

function renderEstudosDia() {
  dom.estudosDia.replaceChildren();
  const doDia = estado.conteudos.filter((c) => c.data === estado.diaSelecionado);
  if (!doDia.length) {
    dom.estudosDia.append(criar("li", {
      classe: "vazio", texto: `Nenhum estudo programado para ${formatarData(estado.diaSelecionado)}.`
    }));
    return;
  }
  doDia.forEach((c) => dom.estudosDia.append(criar("li", { classe: classeItemConteudo(c) }, corpoConteudo(c))));
}



const pomodoro = { restante: DURACAO_POMODORO, contabilizado: 0, fimPrevisto: 0, timer: null };

function renderPomodoro() {
  const rodando = pomodoro.timer !== null;
  dom.tempo.textContent = formatarRelogio(pomodoro.restante);
  dom.btnIniciar.disabled = rodando;
  dom.btnPausar.disabled = !rodando;
  dom.btnReiniciar.disabled = !rodando && pomodoro.restante === DURACAO_POMODORO;
}

function pararTimer() {
  clearInterval(pomodoro.timer);
  pomodoro.timer = null;
}

function zerarCiclo() {
  pomodoro.restante = DURACAO_POMODORO;
  pomodoro.contabilizado = 0;
}

function atualizarPomodoro() {
  pomodoro.restante = Math.max(0, Math.ceil((pomodoro.fimPrevisto - Date.now()) / 1000));
  const decorrido = DURACAO_POMODORO - pomodoro.restante;
  estado.tempoEstudadoSeg += decorrido - pomodoro.contabilizado;
  pomodoro.contabilizado = decorrido;
  renderTempoEstudado();

  if (pomodoro.restante === 0) {
    pararTimer();
    registrarAtividade(`Sessão de Pomodoro concluída (${DURACAO_POMODORO / 60} min)`);
    setTimeout(() => window.alert("Pomodoro concluído! Hora de uma pausa."), 50);
  }
  renderPomodoro();
}

function iniciarPomodoro() {
  if (pomodoro.timer !== null) return;
  if (pomodoro.restante === 0) zerarCiclo();
  pomodoro.fimPrevisto = Date.now() + pomodoro.restante * 1000;
  pomodoro.timer = setInterval(atualizarPomodoro, 250);
  renderPomodoro();
}

function pausarPomodoro() {
  if (pomodoro.timer === null) return;
  atualizarPomodoro(); 
  pararTimer();
  renderPomodoro();
}

function reiniciarPomodoro() {
  pararTimer();
  zerarCiclo(); 
  renderPomodoro();
}

dom.btnIniciar.addEventListener("click", iniciarPomodoro);
dom.btnPausar.addEventListener("click", pausarPomodoro);
dom.btnReiniciar.addEventListener("click", reiniciarPomodoro);


function renderTudo(chaveFoco) {
  const { editando } = estado;
  if (editando && !(editando.tipo === "materia" ? buscarMateria(editando.id) : buscarConteudo(editando.id))) {
    estado.editando = null;
  }
  renderSelects();
  renderMaterias();
  renderConteudos();
  renderDashboard();
  renderSemana();
  renderEstudosDia();
  renderAtividades();
  restaurarFoco(chaveFoco);
}

botoesNav.forEach((botao) => botao.addEventListener("click", () => mostrarTela(botao.dataset.tela)));

try {
  mostrarTela("dashboard");
  renderTudo();
  renderPomodoro();
} catch (erro) {
  console.error("Falha ao iniciar o Dashboard de Estudos:", erro);
}