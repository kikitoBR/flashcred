Vamos criar o módulo do fluxo de do banco PAN.

link: https://veiculos.bancopan.com.br/login

login: id="login"

Senha: id="password"

botão entrar clicável apenas após inserir credenciais: <span class="pan-mahoe-button__wrapper">
  <!----><div class="pan-mahoe-button__icon pan-mahoe-button__icon--left">
    
  </div>
  <!----><div class="pan-mahoe-button__icon pan-mahoe-button__icon--center">
    
  </div>
  <!----><!---->
    Entrar
  
  <!---->
  <!----><div class="pan-mahoe-button__icon pan-mahoe-button__icon--right">
    
  </div>
  <!----><div class="pan-mahoe-button__icon pan-mahoe-button__icon--justify">
    <i _ngcontent-dce-c0="" aria-hidden="true" class="icon-justify pan-mahoe-icon login__spinner-color pan-mahoe-icon-arrow-go">
              <!---->
            </i>
  </div>
</span>


após login redireciona para: https://veiculos.bancopan.com.br/captura/inicio

inserir cpf: <input _ngcontent-yrx-c16="" aria-haspopup="listbox" aria-labelledby="combo-label" class="combo__input ng-pristine ng-valid ng-touched combo__input--lined" id="combo__input" role="combobox" tabindex="0" type="text" aria-controls="listbox-cpf" aria-expanded="false" aria-activedescendant="" placeholder="000.000.000-00" autocomplete="off">


inserir celular: <input _ngcontent-dce-c32="" class="offers__container__content__inputs__user-data hydrated ng-touched ng-dirty ng-invalid" formcontrolname="cellNumber" icon-position="left" inputid="cellNumber" maxlength="15" placeholder="Digite o celular..." type="tel" variant="lined" autocomplete="off" inputmode="text">


digitar placa: <div _ngcontent-dce-c23="" class="combo hide-arrow">
    <input _ngcontent-dce-c23="" aria-haspopup="listbox" aria-labelledby="combo-label" class="combo__input ng-pristine ng-valid ng-touched combo__input--lined combo__input__icon-plate" id="combo__input" role="combobox" tabindex="0" type="text" gen-placa="" aria-controls="listbox-plate" aria-expanded="false" aria-activedescendant="" placeholder="Digite a placa..." autocomplete="off" maxlength="7" style="background: url(&quot;assets/images/icons/card-icon.svg&quot;) left center no-repeat; padding-left: 40px;">
    <!---->
    <!---->
    <!---->
    <!---->
    <!----><div _ngcontent-dce-c23="" class="select-button ng-star-inserted">
        <div _ngcontent-dce-c38="" button="">
        
          <mahoe-button _ngcontent-dce-c32="" class="offers__container__content__data__button hydrated" onkeypress="" variant="ghost" size="md"><!----><button _ngcontent-dce-c32="" class="mahoe-button mahoe-button__ghost" variant="ghost" type="button" size="md"><span class="mahoe-button__container"><img alt="Ícone" src="assets/images/icons/arrow-reload.svg" class="icon__left" aria-hidden="true" width="20" height="20"><span class="mahoe-button__label">
            Preencher manualmente
          </span></span><div class="mahoe-ripple"></div></button></mahoe-button>
        
      </div>
    </div>
</div>


inserir o valor da venda (veículo):  <input _ngcontent-yrx-c40="" inputid="value" label="Valor de venda" mask="currency" placeholder="R$ 0,00" type="text" variant="lined" autocomplete="off" inputmode="text">


inserir o valor da entrada: <input _ngcontent-yrx-c40="" inputid="requestedEntry" label="Valor de entrada" mask="currency" placeholder="R$ 0,00" type="text" variant="lined" autocomplete="off" inputmode="text">

selecionar UF de licenciamento: <div class="combo"><div role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-owns="mahoe-1-listbox" class="input-wrapper mahoe-search"><div class="mahoe-search__input"><input _ngcontent-yrx-c40="" label="UF licenciamento" placeholder="UF" variant="lined" aria-activedescendant="" aria-autocomplete="list" aria-labelledby="mahoe-1" class="typography-body-1" type="text" hide-search-icon=""><svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg" class="mahoe-search__arrow"><path d="M5.84615 7.15655C5.45392 7.7793 4.54608 7.7793 4.15385 7.15655L0.76935 1.78294C0.34993 1.11702 0.828509 0.25 1.6155 0.25L8.3845 0.250001C9.17149 0.250001 9.65007 1.11702 9.23065 1.78294L5.84615 7.15655Z" fill="#0D1317"></path></svg></div><div class="combo-menu typography-body-2" role="listbox" id="mahoe-1-listbox" style="visibility: hidden;"><div class="combo-option" id="mahoe-1-0" aria-selected="true" role="option">RJ</div></div></div></div>

botão SImular: <mahoe-button _ngcontent-yrx-c26="" class="d-flex align-self-end col-sm-6 offers__search-btn hydrated" onkeypress="" size="lg" variant="primary"><!----><button _ngcontent-yrx-c26="" class="mahoe-button mahoe-button__primary" size="lg" variant="primary" type="button"><span class="mahoe-button__container"><span class="mahoe-button__label">
    Simular
  </span></span><div class="mahoe-ripple"></div></button></mahoe-button>

depois que aparecer os resultados, só extrair os resultados. para ver todas as parcelas, precisa abrir uma combobox/listbox: <input _ngcontent-yrx-c16="" aria-haspopup="listbox" aria-labelledby="combo-label" class="combo__input ng-pristine ng-valid ng-touched combo__input--lined type-select" id="combo__input" role="combobox" tabindex="0" type="text" aria-controls="listbox-installment" aria-expanded="false" aria-activedescendant="" autocomplete="off">
 