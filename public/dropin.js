const clientKey = document.getElementById("clientKey").innerHTML;
const { AdyenCheckout, Dropin } = window.AdyenWeb;

// Used to finalize a checkout call in case of redirect
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('sessionId'); // Unique identifier for the payment session
const redirectResult = urlParams.get('redirectResult');

async function startCheckout() {
  try {
    const checkoutDetails = {
      amount: {
        value: 10000,
        currency: 'EUR'
      },
      locale: "en_US",
      countryCode: 'NL'
    };

    const paymentMethodsResponse = await fetch('/api/paymentMethods', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: checkoutDetails
    }).then(response => response.json());

    const configuration = {
      paymentMethodsResponse: paymentMethodsResponse,
      clientKey,
      environment: "test",
      amount: checkoutDetails.amount,
      locale: checkoutDetails.locale,
      countryCode: checkoutDetails.countryCode,
      showPayButton: true,
      // override Security Code label
      translations: {
        'en-US': {
          'creditCard.securityCode.label': 'CVV/CVC'
        }
      },
      onSubmit: async (state, component, actions) => {
        console.info("onSubmit", state, component, actions);
        try {
          if (state.isValid) {
            const { action, order, resultCode } = await fetch("/api/payments", {
              method: "POST",
              body: state.data ? JSON.stringify(state.data) : "",
              headers: {
                "Content-Type": "application/json",
              }
            }).then(response => response.json());

            if (!resultCode) {
              console.warn("reject");
              actions.reject();
            }

            actions.resolve({
              resultCode,
              action,
              order
            });
          }
        } catch (error) {
          console.error(error);
          actions.reject();
        }
      },
      onPaymentCompleted: (result, component) => {
        console.info("onPaymentCompleted", result, component);
        handleOnPaymentCompleted(result.resultCode);
      },
      onPaymentFailed: (result, component) => {
        console.info("onPaymentFailed", result, component);
        handleOnPaymentFailed(result.resultCode);
      },
      onError: (error, component) => {
        console.error("onError", error.name, error.message, error.stack, component);
        window.location.href = "/result/error";
      },
      // Used for the Native 3DS2 Authentication flow, see: https://docs.adyen.com/online-payments/3d-secure/native-3ds2/
      onAdditionalDetails: async (state, component, actions) => {
        console.info("onAdditionalDetails", state, component);
        try {
          const { resultCode } = await fetch("/api/payments/details", {
            method: "POST",
            body: state.data ? JSON.stringify(state.data) : "",
            headers: {
              "Content-Type": "application/json",
            }
          }).then(response => response.json());

          if (!resultCode) {
            console.warn("reject");
            actions.reject();
          }

          actions.resolve({ resultCode });
        } catch (error) {
          console.error(error);
          actions.reject();
        }
      }
    };

    const paymentMethodsConfiguration = {
      card: {
        showBrandIcon: true,
        hasHolderName: true,
        holderNameRequired: true,
        name: "Credit or debit card",
        amount: checkoutDetails.amount,
        placeholders: {
          cardNumber: '1234 5678 9012 3456',
          expiryDate: 'MM/YY',
          securityCodeThreeDigits: '123',
          securityCodeFourDigits: '1234',
          holderName: 'J. Smith'
        }
      }
    };

    // Start the AdyenCheckout and mount the element onto the 'payment' div.
    const adyenCheckout = await AdyenCheckout(configuration);
    const dropin = new Dropin(adyenCheckout, {
      paymentMethodsConfiguration: paymentMethodsConfiguration
    }).mount('#dropin-container');

  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details.");
  }
}

// Function to handle payment completion redirects
function handleOnPaymentCompleted(resultCode) {
  switch (resultCode) {
    case "Authorised":
      window.location.href = "/result/success";
      break;
    case "Pending":
    case "Received":
      window.location.href = "/result/pending";
      break;
    default:
      window.location.href = "/result/error";
      break;
  }
}

// Function to handle payment failure redirects
function handleOnPaymentFailed(resultCode) {
  switch (resultCode) {
    case "Cancelled":
    case "Refused":
      window.location.href = "/result/failed";
      break;
    default:
      window.location.href = "/result/error";
      break;
  }
}

startCheckout();
