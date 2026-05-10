export default function Home() {
  return (
    <div dangerouslySetInnerHTML={{ __html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>CapDrawn</title>

<style>
body{
  margin:0;
  background:#fff;
  font-family:Arial,sans-serif;
}

.center{
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  flex-direction:column;
}

h1{
  font-size:48px;
  margin:0;
}

p{
  color:#666;
}
</style>
</head>

<body>

<div class="center">
  <h1>CapDrawn</h1>
  <p>Projeto funcionando no Railway 🚀</p>
</div>

</body>
</html>
`}} />
  )
}
