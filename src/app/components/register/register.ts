import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray, AbstractControl, ValidationErrors } from '@angular/forms';
import Swal from 'sweetalert2';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { GlobalService } from '../../services/global.service';
/* import { register as registerSwiperElements } from 'swiper/element/bundle';
 */import { NO_ERRORS_SCHEMA } from '@angular/core';
import { Terms } from '../terms/terms';
import { Privacy } from '../privacy/privacy';
import { EmailService } from '../../services/email.service';
import { Router, RouterLink } from '@angular/router';
@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, Terms, Privacy, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class RegisterComponent {
  public selectedImage: string | null = null; // Para previsualización de imagen
  showModal: boolean = false;
  modalTitle: string = '';
  isSubmitting = false;
  modalContent: 'terms' | 'privacy' | null = null;
  currentStep = 1;
  userType: 'partner' | 'client' | null = null;
  // Formulario principal
  formType: 'partner' | 'client' = 'partner';
  // FormGroups separados
  partnerForm: FormGroup;
  clientForm: FormGroup;
  // Configuración del swiper
  swiperConfig = {
    slidesPerView: 1,
    spaceBetween: 30,
    pagination: {
      clickable: true,
      type: 'bullets'
    }
  };
  profileImage: string | null = null;
  selectedProfileFile: File | null = null;
  imageUrl: string = 'assets/images/avatar/1.jpg';
  selectedFile: File | null = null;
  private baseUrl: string = 'https://db.ongomatch.com:8090';

  @ViewChild('profileFileInput') profileFileInput!: ElementRef;
  showPassword = false;
  showConfirmPassword = false;
  loadingGoogle = false;
  constructor(
    private fb: FormBuilder,
    public auth: AuthPocketbaseService,
    public global: GlobalService,
    public emailService: EmailService,
    public router: Router
  ) {
    // Formulario para partners (locales nocturnos)
    this.partnerForm = this.fb.group({
      // Paso 1
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],

      // Paso 2
      venueName: ['', [Validators.required, Validators.maxLength(100)]],
      address: ['', [Validators.required, Validators.maxLength(200)]],
      phone: ['', [Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]],

      // Paso 3
      description: ['', Validators.maxLength(500)],
      capacity: ['', Validators.pattern(/^[0-9]*$/)],
      openingHours: [''],
      terms: [false, Validators.requiredTrue]

    }, {
      validators: [this.passwordMatchValidator, this.validateOpeningHours]
    });

    // Formulario para clientes
    this.clientForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
      address: ['', [Validators.required, Validators.maxLength(200)]],
      name: ['', Validators.required],
      birthday: ['', [Validators.required, this.validateAge]],
      gender: ['', Validators.required],

      orientation: this.fb.group({
        heterosexual: [false],
        gay: [false],
        lesbiana: [false],
        bisexual: [false],
        asexual: [false],
        queer: [false],
        demisexual: [false]
      }),

      interestedIn: ['', Validators.required],
      lookingFor: ['', Validators.required],
      terms: [false, Validators.requiredTrue]
    }, { validators: this.passwordMatchValidator });
  }
  // Agrega este getter para acceder fácilmente a los controles del formulario de partner
  get pf() {
    return this.partnerForm.controls;
  }
  validateOpeningHours(control: AbstractControl): ValidationErrors | null {
    const hours = control.get('openingHours')?.value;
    if (hours && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]\s*-\s*([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(hours)) {
      return { invalidHours: true };
    }
    return null;
  }
  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }
  openTermsModal(type: 'terms' | 'privacy') {
    console.log('Abriendo modal con tipo:', type);
    this.modalContent = type;
    switch (type) {
      case 'terms':
        this.modalTitle = 'Términos y Condiciones';
        break;
      case 'privacy':
        this.modalTitle = 'Política de Privacidad';
        break;
    }
    this.showModal = true;
    console.log('Estado del modal:', { showModal: this.showModal, modalTitle: this.modalTitle, modalContent: this.modalContent });
  }


  async uploadImage() {

    if (this.selectedFile) {

      const formData = new FormData();
      formData.append('file', this.selectedFile!, this.selectedFile!.name);

      const fileRecord = await this.auth.pb.collection('files').create(formData);

      // Construir URL real
      const fileUrl = `${this.baseUrl}/api/files/${fileRecord.collectionId}/${fileRecord.id}/${fileRecord['file']}`;

      // Guardar en this.imageUrl para luego usarlo al crear el usuario
      this.imageUrl = fileUrl;

      console.log('✅ URL generada:', this.imageUrl);

    }
  }
  goBackToTypeSelection(): void {
    this.userType = null;
    this.currentStep = 1;
    this.showPassword = false;
    this.showConfirmPassword = false;
  }
  openProfileFileSelector() {
    this.profileFileInput.nativeElement.click();
  }
  closeModal() {
    this.showModal = false;
    this.modalContent = null;
  }

  currentUserId: string | null = null;

  async onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (!file) return;

    // Step 1: Upload file to PocketBase 'files' collection
    const formData = new FormData();
    formData.append('file', file);
    // Optionally add userId/type if needed
    formData.append('userId', this.currentUserId!); // set this accordingly
    formData.append('type', 'profile');

    try {
      const fileRecord = await this.auth.pb.collection('files').create(formData);
      // Construct the file URL
      const fileUrl = `${this.baseUrl}/api/files/${fileRecord.collectionId}/${fileRecord.id}/${fileRecord['file']}`;

      // Step 2: Save the file URL in usuariosClient.photos (as JSON)
      // If you want to allow multiple photos, you can push to an array
      const photos = [fileUrl]; // or merge with existing if needed

      await this.auth.pb.collection('usuariosClient').update(this.currentUserId!, {
        photos: JSON.stringify(photos) // make sure the field is JSON type
      });

      // Optionally update the UI
      this.imageUrl = fileUrl;
    } catch (error) {
      console.error('Falla al cargar una imagen:', error);
    }
  }
  async onSubmit() {
    try {
      if (this.userType === 'partner') {
        await this.registerPartner();
      } else if (this.userType === 'client') {
        await this.registerClient();
      }
    } catch (error: any) {
      console.error('Error completo en el registro:', error);
      console.error('Datos de error:', error?.data);

      const pbFields = error?.data?.data || {};
      const errorMessage =
        pbFields?.email?.message ||
        pbFields?.name?.message ||
        pbFields?.address?.message ||
        pbFields?.birthday?.message ||
        pbFields?.gender?.message ||
        pbFields?.interestedIn?.message ||
        pbFields?.lookingFor?.message ||
        pbFields?.photos?.message ||
        error?.data?.message ||
        error?.message ||
        'Hubo un problema al registrar tu cuenta.';

      Swal.fire({
        title: 'Error',
        text: errorMessage,
        icon: 'error',
        confirmButtonText: 'Entendido'
      });
    } finally {
      this.isSubmitting = false;
    }
  }
  resetForm() {
    this.partnerForm.reset();
    this.clientForm.reset();
    this.currentStep = 1;
    this.userType = null;
    this.isSubmitting = false;
  }

  async registerPartner() {
    this.isSubmitting = true;

    if (this.partnerForm.invalid) {
      this.markPartnerFieldsAsTouched(this.currentStep);
      this.isSubmitting = false;
      return;
    }

    try {
      const formData = this.partnerForm.value;

      const userResponse = await this.auth.onlyRegisterUser(
        formData.email,
        formData.password,
        'partner',
        formData.venueName
      ).toPromise();

      const partnerData: any = {
        userId: userResponse.id,
        venueName: formData.venueName,
        address: formData.address,
        phone: formData.phone,
        description: formData.description,
        capacity: formData.capacity,
        openingHours: formData.openingHours,
        lat: formData.lat,
        lng: formData.lng,
        email: formData.email,
        status: 'pending',
        approved: false
      };

      await this.auth.pb.collection('usuariosPartner').create(partnerData);

      this.emailService.sendWelcome({
        toEmail: formData.email,
        toName: formData.venueName,
        userType: 'partner',
        params: { venueName: formData.venueName }
      }).catch(err => console.warn('Fallo en el envío del email de bienvenida:', err));

      await this.auth.loginUser(formData.email, formData.password).toPromise();

      // mantener navegación virtual
      this.router.navigate(['profile-local']);

      Swal.fire({
        title: 'Registro Exitoso',
        text: 'Tu local ha sido registrado. Estará activo después de la aprobación.',
        icon: 'success',
        confirmButtonText: 'Entendido'
      });

    } catch (error) {
      console.error('Error registrando partner:', error);
      throw error;
    } finally {
      this.isSubmitting = false;
    }
  }

  /* async registerClient() {
    this.isSubmitting = true;

    if (this.clientForm.invalid) {
      this.markClientFieldsAsTouched(this.currentStep);
      console.log('clientForm INVALIDO');
      console.log('valor:', this.clientForm.value);
      this.isSubmitting = false;
      return;
    }

    try {
      const formData = this.clientForm.value;

      // 1. Crear usuario base
      const userResponse = await this.auth.onlyRegisterUser(
        formData.email,
        formData.password,
        'client',
        formData.name
      ).toPromise();

      console.log('Usuario base creado:', userResponse);

      let uploadedPhotos: string[] = [];

      // 2. Subir imagen si existe
      if (this.selectedFile) {
        const imageFormData = new FormData();
        imageFormData.append('file', this.selectedFile, this.selectedFile.name);

        // agrega estos si tu colección files los exige
        imageFormData.append('userId', userResponse.id);
        imageFormData.append('type', 'profile');

        const fileRecord = await this.auth.pb.collection('files').create(imageFormData);

        const fileUrl = `${this.baseUrl}/api/files/${fileRecord.collectionId}/${fileRecord.id}/${fileRecord['file']}`;
        uploadedPhotos = [fileUrl];
        this.imageUrl = fileUrl;

        console.log('Imagen subida:', fileUrl);
      }

      // 3. Preparar orientación
      const orientationGroup = formData.orientation || {};
      const selectedOrientation = Object.keys(orientationGroup).filter(
        key => orientationGroup[key]
      );

      // 4. Crear perfil usuario cliente
      const clientData: any = {
        userId: userResponse.id,
        name: formData.name,
        address: formData.address,
        birthday: new Date(formData.birthday).toISOString(),
        gender: formData.gender,
        orientation: selectedOrientation,
        interestedIn: formData.interestedIn,
        lookingFor: formData.lookingFor,
        email: formData.email,
        status: 'pending',
        profileComplete: true,
        photos: uploadedPhotos
      };

      console.log('Datos del cliente usuario:', clientData);

      await this.auth.pb.collection('usuariosClient').create(clientData);
      console.log('Perfil usuariosClient creado correctamente');

      this.emailService.sendWelcome({
        toEmail: formData.email,
        toName: formData.name,
        userType: 'client',
        params: { plan: 'free' }
      }).catch(err => console.warn('Fallo en el envío del email de bienvenida:', err));

      await this.auth.loginUser(formData.email, formData.password).toPromise();

      // mantener navegación virtual
      this.router.navigate(['profile']);

      Swal.fire({
        title: 'Registro exitoso',
        text: `¡Bienvenido/a, ${formData.name}! Tu perfil ha sido creado exitosamente.`,
        icon: 'success',
        confirmButtonText: 'Continuar'
      });

    } catch (error: any) {
      console.error('Error registrando cliente:', error);
      console.error('Datos de error de PocketBase:', error?.data);
      throw error;
    } finally {
      this.isSubmitting = false;
    }
  } */
  async registerClient() {
  this.isSubmitting = true;

  if (this.clientForm.invalid) {
    this.markClientFieldsAsTouched(this.currentStep);
    this.isSubmitting = false;
    return;
  }

  try {
    const formData = this.clientForm.value;
    const authRecord = this.auth.pb.authStore.record;

    let userId: string;
    let isGoogleFlow = false;

    if (authRecord?.id) {
      userId = authRecord.id;
      isGoogleFlow = true;
    } else {
      const userResponse = await this.auth.onlyRegisterUser(
        formData.email,
        formData.password,
        'client',
        formData.name
      ).toPromise();

      userId = userResponse.id;

      await this.auth.loginUser(formData.email, formData.password).toPromise();
    }

    let uploadedPhotos: string[] = [];

    if (this.selectedFile) {
      const imageFormData = new FormData();
      imageFormData.append('file', this.selectedFile, this.selectedFile.name);
      imageFormData.append('userId', userId);
      imageFormData.append('type', 'profile');

      const fileRecord = await this.auth.pb.collection('files').create(imageFormData);
      const fileUrl = `${this.baseUrl}/api/files/${fileRecord.collectionId}/${fileRecord.id}/${fileRecord['file']}`;
      uploadedPhotos = [fileUrl];
      this.imageUrl = fileUrl;
    }

    const orientationGroup = formData.orientation || {};
    const selectedOrientation = Object.keys(orientationGroup).filter(
      key => orientationGroup[key]
    );

    const clientData = {
      userId,
      name: formData.name,
      address: formData.address,
      birthday: new Date(formData.birthday).toISOString(),
      gender: formData.gender,
      orientation: selectedOrientation,
      interestedIn: formData.interestedIn,
      lookingFor: formData.lookingFor,
      email: formData.email || authRecord?.['email'] || '',
      status: 'pending',
      profileComplete: true,
      photos: uploadedPhotos
    };

    // Upsert manual
    try {
      const existing = await this.auth.pb
        .collection('usuariosClient')
        .getFirstListItem(`userId="${userId}"`);

      await this.auth.pb.collection('usuariosClient').update(existing.id, clientData);
    } catch (error: any) {
      if (error?.status === 404) {
        await this.auth.pb.collection('usuariosClient').create(clientData);
      } else {
        throw error;
      }
    }

    if (!isGoogleFlow) {
      this.emailService.sendWelcome({
        toEmail: formData.email,
        toName: formData.name,
        userType: 'client',
        params: { plan: 'free' }
      }).catch(err => console.warn('Fallo en email:', err));
    }

    await this.global.loadProfile();
    await this.global.initClientesRealtime();
    await this.global.initPartnersRealtime();

    await this.router.navigate(['/profile']);

    Swal.fire({
      title: 'Registro exitoso',
      text: `¡Bienvenido/a, ${formData.name}! Tu perfil ha sido creado exitosamente.`,
      icon: 'success',
      confirmButtonText: 'Continuar'
    });

  } catch (error: any) {
    console.error('Error registrando cliente:', error);
    throw error;
  } finally {
    this.isSubmitting = false;
  }
}

  getFormErrors(form: FormGroup): { [key: string]: string } {
    const errors: { [key: string]: string } = {};
    Object.keys(form.controls).forEach(key => {
      const control = form.controls[key];
      if (control.errors) {
        errors[key] = Object.values(control.errors)[0];
      }
    });
    return errors;
  }

  // Tag visual de éxito
  public successTag: { show: boolean, message: string } = { show: false, message: '' };
  public closeSuccessTag() {
    this.successTag.show = false;
  }
  // Generar contraseña aleatoria para clientes (que usan OTP)
  generateRandomPassword(): string {
    return Math.random().toString(36).slice(-8);
  }

  // Mostrar mensajes
  showSuccessAndLogin(email: string, password: string) {
    Swal.fire({
      title: 'Registro Exitoso',
      text: 'Tu cuenta ha sido creada correctamente.',
      icon: 'success'
    }).then(() => {
      this.auth.loginUser(email, password).subscribe({
        next: () => {
          this.router.navigate(['home-local']);
        },
        error: () => {
          this.router.navigate(['login']);
        }
      });
    });
  }

  showSuccessAndRedirect() {
    Swal.fire({
      title: 'Registro Exitoso',
      text: 'Por favor verifica tu teléfono con el código OTP enviado.',
      icon: 'success'
    }).then(() => {
      this.router.navigate(['otp-verification']);
    });
  }

  showError(error: any) {
    console.error('Error:', error);
    Swal.fire({
      title: 'Error',
      text: 'Hubo un problema al registrar tu cuenta. Por favor intenta nuevamente.',
      icon: 'error'
    });
  }

  // Validador de coincidencia de contraseñas
  passwordMatchValidator(form: AbstractControl): ValidationErrors | null {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    if (password && confirmPassword && password !== confirmPassword) {
      return { mismatch: true };
    }
    return null;
  }


  // Manejo de selección de tipo de usuario
  /*  selectUserType(type: 'partner' | 'client') {
     this.userType = type;
     this.nextStep();
     if (type === 'partner') {
       this.setPartnerStepValidators(1);
     }
     if (type === 'client') {
       this.setClientStepValidators(1);
     }
   } */
  selectUserType(type: 'partner' | 'client'): void {
    this.userType = type;
    this.currentStep = 1;
    this.showPassword = false;
    this.showConfirmPassword = false;
  }
  /* setClientStepValidators(step: number) {
    // Limpiar validadores de todos los campos
    const controls = this.clientForm.controls;
    Object.keys(controls).forEach(key => {
      controls[key].clearValidators();
      controls[key].updateValueAndValidity({ emitEvent: false });
    });
  
    // Paso 1: Credenciales
    if (step === 1) {
      controls['email'].setValidators([Validators.required, Validators.email]);
      controls['password'].setValidators([Validators.required, Validators.minLength(8)]);
      controls['confirmPassword'].setValidators([Validators.required]);
    }
    // Paso 2: Datos del cliente
    else if (step === 2) {
      controls['firstName'].setValidators([Validators.required, Validators.maxLength(100)]);
      controls['address'].setValidators([Validators.required, Validators.maxLength(200)]);
      controls['phone'].setValidators([Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]);
    }
    // Actualizar validadores
    Object.keys(controls).forEach(key => controls[key].updateValueAndValidity({ emitEvent: false }));
  
    // Mantener el validador de grupo (coincidencia de contraseñas)
    this.clientForm.setValidators(this.passwordMatchValidator);
    this.clientForm.updateValueAndValidity({ emitEvent: false });
  } */

  setClientStepValidators(step: number) {
    const controls = this.clientForm.controls;

    Object.keys(controls).forEach(key => {
      controls[key].clearValidators();
      controls[key].updateValueAndValidity({ emitEvent: false });
    });

    if (step === 1) {
      controls['email'].setValidators([Validators.required, Validators.email]);
      controls['password'].setValidators([Validators.required, Validators.minLength(8)]);
      controls['confirmPassword'].setValidators([Validators.required]);
    } else if (step === 2) {
      controls['name'].setValidators([Validators.required]);
      controls['birthday'].setValidators([Validators.required, this.validateAge]);
      controls['gender'].setValidators([Validators.required]);
    } else if (step === 3) {
      controls['interestedIn'].setValidators([Validators.required]);
      controls['lookingFor'].setValidators([Validators.required]);
    } else if (step === 4) {
      controls['terms'].setValidators([Validators.requiredTrue]);
    }

    Object.keys(controls).forEach(key =>
      controls[key].updateValueAndValidity({ emitEvent: false })
    );

    this.clientForm.setValidators(this.passwordMatchValidator);
    this.clientForm.updateValueAndValidity({ emitEvent: false });
  }


  // Navegación entre pasos

  nextStep() {
    if (this.userType === 'partner') {
      if (
        this.currentStep === 1 &&
        (
          this.partnerForm.get('email')?.invalid ||
          this.partnerForm.get('password')?.invalid ||
          this.partnerForm.get('confirmPassword')?.invalid ||
          this.partnerForm.errors?.['mismatch']
        )
      ) {
        this.markPartnerFieldsAsTouched(1);
        return;
      }

      if (
        this.currentStep === 2 &&
        (
          this.partnerForm.get('venueName')?.invalid ||
          this.partnerForm.get('address')?.invalid ||
          this.partnerForm.get('phone')?.invalid
        )
      ) {
        this.markPartnerFieldsAsTouched(2);
        return;
      }

      this.currentStep++;
      return;
    }

    if (this.userType === 'client') {
      if (
        this.currentStep === 1 &&
        (
          this.clientForm.get('email')?.invalid ||
          this.clientForm.get('password')?.invalid ||
          this.clientForm.get('confirmPassword')?.invalid ||
          this.clientForm.errors?.['mismatch']
        )
      ) {
        this.markClientFieldsAsTouched(1);
        return;
      }

      if (
        this.currentStep === 2 &&
        (
          this.clientForm.get('name')?.invalid ||
          this.clientForm.get('birthday')?.invalid ||
          this.clientForm.get('gender')?.invalid
        )
      ) {
        this.markClientFieldsAsTouched(2);
        return;
      }

      if (
        this.currentStep === 3 &&
        (
          this.clientForm.get('interestedIn')?.invalid ||
          this.clientForm.get('lookingFor')?.invalid
        )
      ) {
        this.markClientFieldsAsTouched(3);
        return;
      }

      this.currentStep++;
    }
  }


  prevStep() {
    this.currentStep--;
  }
  setPartnerStepValidators(step: number) {
    // Limpiar validadores de todos los campos
    const controls = this.partnerForm.controls;
    Object.keys(controls).forEach(key => {
      controls[key].clearValidators();
      controls[key].updateValueAndValidity({ emitEvent: false });
    });

    // Paso 1: Credenciales
    if (step === 1) {
      controls['email'].setValidators([Validators.required, Validators.email]);
      controls['password'].setValidators([Validators.required, Validators.minLength(8)]);
      controls['confirmPassword'].setValidators([Validators.required]);
    }
    // Paso 2: Datos del local
    else if (step === 2) {
      controls['venueName'].setValidators([Validators.required, Validators.maxLength(100)]);
      controls['address'].setValidators([Validators.required, Validators.maxLength(200)]);
      controls['phone'].setValidators([Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]);
    }
    // Paso 3: Preferencias y términos
    else if (step === 3) {
      controls['description'].setValidators([Validators.required, Validators.maxLength(500)]);
      controls['capacity'].setValidators([Validators.required, Validators.min(10)]);
      controls['openingHours'].setValidators([Validators.required, this.validateOpeningHours]);
      controls['terms'].setValidators([Validators.requiredTrue]);
    }
    // Actualizar validadores
    Object.keys(controls).forEach(key => controls[key].updateValueAndValidity({ emitEvent: false }));

    // Mantener el validador de grupo (coincidencia de contraseñas)
    this.partnerForm.setValidators(this.passwordMatchValidator);
    this.partnerForm.updateValueAndValidity({ emitEvent: false });
  }

  // Marcar campos como tocados para mostrar errores
  markClientFieldsAsTouched(step: number) {
    if (step === 1) {
      this.clientForm.get('email')?.markAsTouched();
      this.clientForm.get('password')?.markAsTouched();
      this.clientForm.get('confirmPassword')?.markAsTouched();
    } else if (step === 2) {
      this.clientForm.get('name')?.markAsTouched();
      this.clientForm.get('birthday')?.markAsTouched();
      this.clientForm.get('gender')?.markAsTouched();
    } else if (step === 3) {
      this.clientForm.get('interestedIn')?.markAsTouched();
      this.clientForm.get('lookingFor')?.markAsTouched();
    } else if (step === 4) {
      this.clientForm.get('terms')?.markAsTouched();
    }
  }

  markPartnerFieldsAsTouched(step: number) {
    if (step === 1) {
      this.partnerForm.get('email')?.markAsTouched();
      this.partnerForm.get('password')?.markAsTouched();
      this.partnerForm.get('confirmPassword')?.markAsTouched();
    } else if (step === 2) {
      this.partnerForm.get('venueName')?.markAsTouched();
      this.partnerForm.get('address')?.markAsTouched();
      this.partnerForm.get('phone')?.markAsTouched();
    } else if (step === 3) {
      this.partnerForm.get('description')?.markAsTouched();
      this.partnerForm.get('capacity')?.markAsTouched();
      this.partnerForm.get('openingHours')?.markAsTouched();
      this.partnerForm.get('terms')?.markAsTouched();
    }
  }

  // Método para el cargador de imagen de perfil simple
  public onImageSelected(event: any): void {
    const file = event.target.files && event.target.files[0];

    if (!file) {
      this.selectedImage = null;
      this.selectedFile = null;
      return;
    }

    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.selectedImage = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // Método para eliminar la imagen seleccionada

  public removeImage(): void {
    this.selectedImage = null;
    this.selectedFile = null;
  }
  // Manejo de imágenes
  handleFileInput(event: any, index: number) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const imageUrl = e.target.result;
        this.photosArray.at(index).setValue(imageUrl);
      };
      reader.readAsDataURL(file);
    }
  }
  validateAge(control: AbstractControl): ValidationErrors | null {
    const birthday = new Date(control.value);
    const ageDiff = Date.now() - birthday.getTime();
    const ageDate = new Date(ageDiff);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);

    return age >= 18 ? null : { underAge: true };
  }


  getSelectedOrientations(): string[] {
    const orientationGroup = this.clientForm.get('orientation')?.value;
    return Object.keys(orientationGroup)
      .filter(key => orientationGroup[key])
      .map(key => key.toLowerCase());
  }
  // Getter para acceder fácilmente a los controles del formulario
  get f() {
    return this.clientForm.controls;
  }

  // Getter para acceder al FormArray de fotos
  get photosArray(): FormArray {
    return this.clientForm.get('photos') as FormArray;
  }
  orientationValidator(control: AbstractControl): ValidationErrors | null {
    const group = control.value;
    const hasSelected = Object.values(group).some(value => value);
    return hasSelected ? null : { required: true };
  }

  async registerWithGoogle(type: 'client' | 'partner') {
  try {
    this.loadingGoogle = true;
    this.userType = type;

    const authUser = await this.auth.loginWithGoogle();

    if (!authUser?.id) {
      throw new Error('No se pudo autenticar con Google.');
    }

    // Guarda el tipo en el auth record si aún no lo tiene
    const currentType = authUser.type || this.auth.pb.authStore.record?.['type'];

    if (!currentType) {
      await this.auth.pb.collection('users').update(authUser.id, {
        type
      });
    }

    if (type === 'client') {
      await this.ensureClientProfile(authUser);
    } else {
      await this.ensurePartnerProfile(authUser);
    }

  } catch (error: any) {
    console.error('Error en registro con Google:', error);

    Swal.fire({
      title: 'Error',
      text: error?.message || 'No fue posible continuar con Google.',
      icon: 'error',
      confirmButtonText: 'Entendido'
    });
  } finally {
    this.loadingGoogle = false;
  }
}
async ensureClientProfile(authUser: any) {
  try {
    const existing = await this.auth.pb
      .collection('usuariosClient')
      .getFirstListItem(`userId="${authUser.id}"`);

    // Ya existe perfil: decidir si está completo o no
    const isComplete =
      !!existing['name'] &&
      !!existing['birthday'] &&
      !!existing['gender'] &&
      !!existing['interestedIn'] &&
      !!existing['lookingFor'];

    if (isComplete) {
      await this.global.loadProfile();
      await this.global.initClientesRealtime();
      await this.global.initPartnersRealtime();
      await this.router.navigate(['/home']);
      return;
    }

    // Precargar formulario y continuar onboarding
    this.clientForm.patchValue({
      email: authUser.email || existing['email'] || '',
      name: existing['name'] || authUser['name'] || authUser['username'] || '',
      address: existing['address'] || '',
      gender: existing['gender'] || '',
      interestedIn: existing['interestedIn'] || '',
      lookingFor: existing['lookingFor'] || '',
      terms: !!existing['terms']
    });

    this.currentStep = 2;
  } catch (error: any) {
    // Si no existe, crearlo parcial
    if (error?.status === 404) {
      const newClient = await this.auth.pb.collection('usuariosClient').create({
        userId: authUser.id,
        email: authUser.email || '',
        name: authUser.name || authUser['username'] || '',
        status: 'pending',
        profileComplete: false,
        photos: []
      });

      this.clientForm.patchValue({
        email: authUser.email || '',
        name: newClient['name'] || authUser['name'] || '',
      });

      this.currentStep = 2;
      return;
    }

    throw error;
  }
}
async ensurePartnerProfile(authUser: any) {
  try {
    const existing = await this.auth.pb
      .collection('usuariosPartner')
      .getFirstListItem(`userId="${authUser.id}"`);

    const isComplete =
      !!existing['venueName'] &&
      !!existing['address'] &&
      !!existing['phone'];

    if (isComplete) {
      await this.global.loadProfile();
      await this.global.initClientesRealtime();
      await this.global.initPartnersRealtime();
      await this.router.navigate(['/home-local']);
      return;
    }

    this.partnerForm.patchValue({
      email: authUser.email || existing['email'] || '',
      venueName: existing['venueName'] || '',
      address: existing['address'] || '',
      phone: existing['phone'] || '',
      description: existing['description'] || '',
      capacity: existing['capacity'] || '',
      openingHours: existing['openingHours'] || ''
    });

    this.currentStep = 2;
  } catch (error: any) {
    if (error?.status === 404) {
      await this.auth.pb.collection('usuariosPartner').create({
        userId: authUser.id,
        email: authUser.email || '',
        status: 'pending',
        approved: false
      });

      this.partnerForm.patchValue({
        email: authUser.email || ''
      });

      this.currentStep = 2;
      return;
    }

    throw error;
  }
}

}
