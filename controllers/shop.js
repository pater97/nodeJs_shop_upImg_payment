const fs = require('fs');
const path = require('path');

const PDFDocument = require('pdfkit');

const Product = require('../models/product');
const Order = require('../models/order');

//definisco la quantità di prodotti per pagina
const ITEMS_PER_PAGE = 2;

exports.getProducts = (req, res, next) => {
  //qui definisco il numero della pagina sfruttando la quary
  const page = +req.query.page || 1;
  //numero totale di prodotti
  let totalItems;

  Product.find()
    //conto i prodotti grazie alla funzione express e inserisco il numero nella variabile
    .countDocuments()
    .then(numProducts => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        //do il limite di prodotti in base alla variabile impostata prima
        .limit(ITEMS_PER_PAGE);
    })
    .then(products => {
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'Products',
        path: '/products',
        //passo la pagina
        currentPage: page,
        //indico se ci sarà o meno la prossima o la precedente pagina
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        //imposto quale saranno le pagine precedenti o successive
        nextPage: page + 1,
        previousPage: page - 1,
        //imposto l'ultima pagina
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products'
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;

  Product.find()
    .countDocuments()
    .then(numProducts => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * ITEMS_PER_PAGE)
        .limit(ITEMS_PER_PAGE);
    })
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        currentPage: page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(result => {
      console.log(result);
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postOrder = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  //estrapolo l'idi dall'url
  const orderId = req.params.orderId;
  //cerco il mio ordine
  Order.findById(orderId)
    .then(order => {
      if (!order) {
        return next(new Error('No order found.'));
      }
      //qui controllo se la richiesta dell'utente è uguale all'utente che ha effettuato l'ordine
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error('Unauthorized'));
      }
      //creo il nome della fattura 
      const invoiceName = 'invoice-' + orderId + '.pdf';
      //indico il percorso della fattura
      const invoicePath = path.join('data', 'invoices', invoiceName);
      //creo il costruttore per i file pdf
      const pdfDoc = new PDFDocument();
      //specifico il tipo di dpcumento
      res.setHeader('Content-Type', 'application/pdf');
      //specifico come voglio che venga servito (se dirattamente su browser o in download) e il nome
      res.setHeader(
        'Content-Disposition',
        'inline; filename="' + invoiceName + '"'
      );
      //salvare il dato
      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      //inviarlo
      pdfDoc.pipe(res);

      //imposto il file come voglio che venga strutturato e i dati che voglio passargli
      //indico che ci sarà un testo "invoice" con 26 come fontsize e sottolineato
      pdfDoc.fontSize(26).text('Invoice', {
        underline: true
      });
      //aggiungo un titolo o come in questo caso un separatore
      pdfDoc.text('-----------------------');
      //creo una variabile alla quale passerò il prezzo definitivo
      let totalPrice = 0;
      //ciclo i prodotti all'interno dell'ordine
      order.products.forEach(prod => {
        //imposto il prezzo
        totalPrice += prod.quantity * prod.product.price;
        //costruisco il file con i miei ordini
        pdfDoc
          .fontSize(14)
          .text(
            prod.product.title +
              ' - ' +
              prod.quantity +
              ' x ' +
              '$' +
              prod.product.price
          );
      });
      pdfDoc.text('---');
      pdfDoc.fontSize(20).text('Total Price: $' + totalPrice);
      //chiudo il file pdf
      pdfDoc.end();
    })
    .catch(err => next(err));
};
