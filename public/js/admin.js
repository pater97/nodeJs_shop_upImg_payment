const deleteProduct = btn => {
    //estrapolo dalla dom l'id del prodotto e la csfr token
    const prodId = btn.parentNode.querySelector('[name=productId]').value;
    const csrf = btn.parentNode.querySelector('[name=_csrf]').value;
    //indico il prodotto che voglio eliminare
    const productElement = btn.closest('article');
    //invio la richiesta al server indicando la rotta
    fetch('/admin/product/' + prodId, {
        //specifico il metodo http che voglio utilizzare
      method: 'DELETE',
      //inserisco anche il token così da poterlo leggere nel server quando lo comparerà per eliminare il prodotto
      headers: {
        'csrf-token': csrf
      }
    })
      .then(result => {
        return result.json();
      })
      .then(data => {
        console.log(data);
        //elimino dalla dom il prodotto
        productElement.parentNode.removeChild(productElement);
        console.log('prodotto eliminato')
      })
      .catch(err => {
        console.log(err);
        console.log('prodotto non eliminato')
      });
  };