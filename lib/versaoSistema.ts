/**
 * Fonte Ãºnica da identificaÃ§Ã£o visual/versÃ£o do sistema (missÃ£o "TELEQUIPE
 * SUPORTE STA â€” EvoluÃ§Ã£o 7.1", item 2: "Caso exista uma constante
 * centralizada de versÃ£o, atualize-a. Evite espalhar '7.3' manualmente por
 * vÃ¡rios componentes."). NÃ£o existia nenhuma constante centralizada antes
 * desta missÃ£o â€” a versÃ£o estava apenas hardcoded como "v7.0" em
 * `components/Sidebar.tsx` (texto solto, sem nenhuma fonte Ãºnica). Esta Ã© a
 * primeira vez que a versÃ£o Ã© centralizada; qualquer componente que precise
 * exibi-la deve importar daqui, nunca escrever o nÃºmero diretamente.
 *
 * NOTA IMPORTANTE sobre o nÃºmero "7.3": o `package.json` deste projeto estÃ¡
 * em "6.0.0" (nunca atualizado por nenhuma sprint), e o HEAD atual do git jÃ¡
 * contÃ©m commits de sprints chamadas "v7.2" (Dashboard Executivo) e "v7.1"
 * (Matriz HierÃ¡rquica de Categoria) â€” ambos NOMES DE SPRINT/MISSÃƒO, nÃ£o uma
 * versÃ£o semver formalmente controlada em nenhum lugar do cÃ³digo antes desta
 * missÃ£o. Esta constante segue literalmente o nÃºmero pedido pela missÃ£o
 * atual ("VersÃ£o 7.1") para a IDENTIFICAÃ‡ÃƒO VISUAL exibida na Sidebar â€” essa
 * decisÃ£o foi confirmada explicitamente pelo usuÃ¡rio apÃ³s a auditoria
 * apontar a aparente inconsistÃªncia com o nome da sprint anterior (v7.2).
 * Ver "LimitaÃ§Ãµes" no relatÃ³rio final desta entrega para o detalhamento
 * completo.
 */

export const NOME_SISTEMA = "TELEQUIPE SUPORTE STA";
export const VERSAO_SISTEMA = "7.3";
export const VERSAO_EXIBICAO = `v${VERSAO_SISTEMA}`;



