function switchView(id){
  $$('.nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===id));
  $$('.view').forEach(x=>x.classList.toggle('active',x.id===id));
  const titles={dashboard:'Olá, Ana!',orders:'Pedidos',manual:'Lançamentos manuais',pending:'Clientes a receber',clients:'Clientes',audit:'Atividades',settings:'Configurações'};
  $('#pageTitle').textContent=titles[id]||'Olá, Ana!';
  renderCurrentView();
  refreshIcons();
}
